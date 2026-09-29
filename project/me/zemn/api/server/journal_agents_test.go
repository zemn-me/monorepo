package apiserver

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func journalAgentTestResponse(value any) *http.Response {
	data, _ := json.Marshal(value)
	return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(bytes.NewReader(data))}
}

func TestJournalAgentsHostedCorpusAndIdempotentSubmission(t *testing.T) {
	const runID = "run-one"
	const corpus = `{"entries":[{"id":"entry-one","transcript":[{"id":"s0","text":"Original evidence"}]}]}`
	creates, starts := 0, 0
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Header.Get("OpenAI-Beta") != "agents=v1" || request.Header.Get("Authorization") != "Bearer test" {
			return nil, errors.New("missing authentication or beta header")
		}
		switch request.Method + " " + request.URL.Path {
		case "GET /v1/agents/sessions":
			return journalAgentTestResponse(map[string]any{"data": []any{}, "has_more": false}), nil
		case "POST /v1/agents/sessions":
			creates++
			var payload struct {
				Agent struct {
					Instructions string `json:"instructions"`
				} `json:"agent"`
				Input       any               `json:"input"`
				Metadata    map[string]string `json:"metadata"`
				Environment struct {
					Type    string `json:"type"`
					Network struct {
						Access string `json:"access"`
					} `json:"network"`
					Files []struct{ Path, Data string } `json:"files"`
				} `json:"environment"`
			}
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				return nil, err
			}
			if !strings.Contains(payload.Agent.Instructions, journalWritingInstructions) {
				return nil, errors.New("hosted curator omitted shared writing guidance")
			}
			if payload.Input != nil || payload.Metadata["journal_run"] != runID || payload.Environment.Type != "openai_hosted" || payload.Environment.Network.Access != "disabled" {
				return nil, errors.New("invalid hosted session")
			}
			var compressed []byte
			for _, file := range payload.Environment.Files {
				data, err := base64.StdEncoding.DecodeString(file.Data)
				if err != nil {
					return nil, err
				}
				compressed = append(compressed, data...)
			}
			reader, err := gzip.NewReader(bytes.NewReader(compressed))
			if err != nil {
				return nil, err
			}
			defer reader.Close()
			data, err := io.ReadAll(reader)
			if err != nil {
				return nil, err
			}
			if string(data) != corpus {
				return nil, errors.New("corpus changed during export")
			}
			return journalAgentTestResponse(map[string]any{"id": "sess_test", "status": "idle"}), nil
		case "POST /v1/agents/sessions/sess_test/events":
			starts++
			if request.Header.Get("Idempotency-Key") != runID {
				return nil, errors.New("missing durable idempotency header")
			}
			if starts == 1 {
				return nil, errors.New("lost submission response")
			}
			return journalAgentTestResponse(nil), nil
		default:
			return nil, fmt.Errorf("unexpected request: %s %s", request.Method, request.URL)
		}
	})}
	curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}, model: "test-model"}
	id, err := curator.Prepare(t.Context(), runID, []byte(corpus))
	if err != nil || id != "sess_test" {
		t.Fatalf("prepare: %s %v", id, err)
	}
	if curator.Start(t.Context(), id, runID) == nil {
		t.Fatal("lost response not reported")
	}
	if err := curator.Start(t.Context(), id, runID); err != nil {
		t.Fatal(err)
	}
	if creates != 1 || starts != 2 {
		t.Fatalf("unexpected automatic retries: %d %d", creates, starts)
	}
}

func TestJournalAgentsRecoverCreatedSession(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != "GET" {
			return nil, errors.New("duplicate session creation")
		}
		return journalAgentTestResponse(map[string]any{"data": []any{map[string]any{"id": "sess_existing", "metadata": map[string]string{"journal_run": "run-one"}}}, "has_more": false}), nil
	})}
	curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
	id, err := curator.Prepare(t.Context(), "run-one", []byte("{}"))
	if err != nil || id != "sess_existing" {
		t.Fatalf("recovery: %s %v", id, err)
	}
}

func TestJournalAgentsCleanupIncludesLostCreationResponse(t *testing.T) {
	deleted := map[string]bool{}
	cancelled := false
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		switch request.Method + " " + request.URL.Path {
		case "GET /v1/agents/sessions":
			return journalAgentTestResponse(map[string]any{"data": []any{
				map[string]any{"id": "orphan", "metadata": map[string]string{"journal_run": "run-one"}},
				map[string]any{"id": "unrelated", "metadata": map[string]string{"journal_run": "run-two"}},
			}, "has_more": false}), nil
		case "GET /v1/agents/sessions/known":
			return journalAgentTestResponse(map[string]any{"id": "known", "status": "in_progress"}), nil
		case "GET /v1/agents/sessions/orphan":
			return journalAgentTestResponse(map[string]any{"id": "orphan", "status": "idle"}), nil
		case "POST /v1/agents/sessions/known/events":
			cancelled = true
			return journalAgentTestResponse(nil), nil
		case "DELETE /v1/agents/sessions/known", "DELETE /v1/agents/sessions/orphan":
			deleted[request.URL.Path] = true
			return journalAgentTestResponse(map[string]any{"deleted": true}), nil
		default:
			return nil, fmt.Errorf("unexpected cleanup request: %s %s", request.Method, request.URL.Path)
		}
	})}
	curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
	if err := curator.Cleanup(t.Context(), "run-one", "known"); err != nil {
		t.Fatal(err)
	}
	if len(deleted) != 2 || !cancelled {
		t.Fatalf("incomplete cleanup: %v, cancelled=%v", deleted, cancelled)
	}
}

func TestJournalAgentsRequireCompletedTurnAndMatchingArtifact(t *testing.T) {
	for _, status := range []string{"in_progress", "failed", "completed"} {
		t.Run(status, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				switch request.URL.Path {
				case "/v1/agents/sessions/sess_test":
					return journalAgentTestResponse(map[string]any{"id": "sess_test", "status": "idle"}), nil
				case "/v1/agents/sessions/sess_test/turns":
					return journalAgentTestResponse(map[string]any{"data": []any{map[string]string{"id": "turn_current", "status": status}}}), nil
				case "/v1/agents/sessions/sess_test/artifacts":
					return journalAgentTestResponse(map[string]any{"data": []any{
						map[string]any{"id": "stale", "path": journalCuratorOutputPath, "turn_id": "turn_old"},
						map[string]any{"id": "current", "path": journalCuratorOutputPath, "turn_id": "turn_current"},
					}, "has_more": false}), nil
				case "/v1/agents/sessions/sess_test/artifacts/current/content":
					return journalAgentTestResponse(map[string]any{"entries": []any{}, "pages": []any{}}), nil
				default:
					return nil, fmt.Errorf("unexpected retrieval: %s", request.URL)
				}
			})}
			curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
			result, err := curator.Collect(context.Background(), "sess_test")
			if status == "completed" {
				if result == nil || err != nil {
					t.Fatalf("missing result: %v", err)
				}
			} else if result != nil {
				t.Fatal("published incomplete turn")
			}
			if status == "failed" && err == nil {
				t.Fatal("failed turn accepted")
			}
		})
	}
}

func TestJournalCurationRejectsTrailingAndUnknownOutput(t *testing.T) {
	for _, body := range []string{`{"entries":[],"pages":[]} {}`, `{"entries":[],"pages":[],"sourceEdits":[]}`} {
		var result JournalCurationResult
		if decodeJournalCurationJSON(strings.NewReader(body), &result) == nil {
			t.Fatal("malformed output accepted")
		}
	}
}
