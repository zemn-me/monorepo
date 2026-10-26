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
	"time"
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
			if !strings.Contains(payload.Agent.Instructions, journalWikiWritingInstructions) {
				return nil, errors.New("hosted curator omitted wiki writing guidance")
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
			body, err := io.ReadAll(request.Body)
			if err != nil || !bytes.Contains(body, []byte("1800 seconds remaining")) || !bytes.Contains(body, []byte("same workspace")) {
				return nil, errors.New("missing remaining time or continuation instructions")
			}
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
	if curator.Start(t.Context(), id, runID, 30*time.Minute) == nil {
		t.Fatal("lost response not reported")
	}
	if err := curator.Start(t.Context(), id, runID, 30*time.Minute); err != nil {
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
	_, _, _, entries, _ := journalKnowledgeFixture(t)
	want := journalKnowledgeResult(entries)
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
					return journalAgentTestResponse(want), nil
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
				if len(result.Entries) != len(want.Entries) || result.Entries[0].EntryId != want.Entries[0].EntryId || result.Pages[0].Id != want.Pages[0].Id {
					t.Fatal("artifact UUIDs did not survive collection")
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

func TestJournalCurationDecodeDiagnosticsExcludeSourceText(t *testing.T) {
	for _, tc := range []struct{ body, diagnostic string }{
		{`{"entries":[{"entryId":[1,2,3]}],"pages":[]}`, "wrong JSON type"},
		{`{"entries":[],"pages":[],"private diary content":1}`, "unknown JSON field"},
		{`{"entries":`, "empty or incomplete JSON"},
		{`private diary content`, "invalid JSON at byte"},
		{`{"entries":[{"entryId":"private diary content"}],"pages":[]}`, "invalid JSON value or document"},
	} {
		var result JournalCurationResult
		err := decodeJournalCurationJSON(strings.NewReader(tc.body), &result)
		if err == nil {
			t.Fatal("invalid output accepted")
		}
		diagnostic := journalCurationDecodeDiagnostic(err)
		if !strings.HasPrefix(diagnostic, tc.diagnostic) || strings.Contains(diagnostic, "private diary content") {
			t.Fatalf("unexpected diagnostic: %s", diagnostic)
		}
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

func TestJournalCurationSchemaUUIDWireFormat(t *testing.T) {
	schema, err := structuredOutputSchema[JournalCurationResult]()
	if err != nil {
		t.Fatal(err)
	}
	properties := schema["properties"].(map[string]any)
	for collection, field := range map[string]string{"entries": "entryId", "pages": "id"} {
		item := properties[collection].(map[string]any)["items"].(map[string]any)
		id := item["properties"].(map[string]any)[field].(map[string]any)
		if id["type"] != "string" || id["format"] != "uuid" {
			t.Errorf("%s.%s must describe the JSON UUID string, got %v", collection, field, id)
		}
	}
}

func TestJournalAgentsFailureExplanations(t *testing.T) {
	for _, tc := range []struct {
		name, status, turnStatus, body, reportTurn, want string
		size                                             int
	}{
		{"no artifacts", "idle", "completed", "", "", "artifacts=0 current_turn=0 expected_output=0", 0},
		{"final with output", "idle", "completed", `{"message":"Permanent blocker", "final":true}`, "turn_current", `agent explanation: "Permanent blocker"`, 0},
		{"final", "idle", "completed", `{"message":"Permanent blocker", "final":true}`, "turn_current", `agent explanation: "Permanent blocker"`, 0},
		{"invalid final flag", "idle", "completed", `{"message":"bad flag", "final":"true"}`, "turn_current", "invalid failure report", 0},
		{"completed", "idle", "completed", `{"message":"Schema validation failed after two repair attempts"}`, "turn_current", `agent explanation: "Schema validation failed after two repair attempts"`, 0},
		{"failed", "failed", "failed", `{"message":"Workspace setup failed"}`, "turn_current", `agent explanation: "Workspace setup failed"`, 0},
		{"requires action", "requires_action", "in_progress", `{"message":"Required tool unavailable"}`, "turn_current", `agent explanation: "Required tool unavailable"`, 0},
		{"stale report", "idle", "completed", `{"message":"DO NOT READ"}`, "turn_old", "artifacts=2 current_turn=0 expected_output=0", 0},
		{"malformed", "idle", "completed", `{"private text":`, "turn_current", "invalid failure report", 0},
		{"oversized metadata", "idle", "completed", `DO NOT READ`, "turn_current", "failure report exceeds size limit", journalCuratorFailureLimit + 1},
		{"oversized body", "idle", "completed", strings.Repeat("x", journalCuratorFailureLimit+1), "turn_current", "failure report exceeds size limit", 0},
		{"log escaping", "idle", "completed", `{"message":"failed\nFORGED LOG LINE"}`, "turn_current", `agent explanation: "failed\nFORGED LOG LINE"`, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				switch request.URL.Path {
				case "/v1/agents/sessions/sess_test":
					return journalAgentTestResponse(map[string]any{"id": "sess_test", "status": tc.status}), nil
				case "/v1/agents/sessions/sess_test/turns":
					return journalAgentTestResponse(map[string]any{"data": []any{map[string]string{"id": "turn_current", "status": tc.turnStatus}}}), nil
				case "/v1/agents/sessions/sess_test/artifacts":
					if tc.name == "no artifacts" {
						return journalAgentTestResponse(map[string]any{"data": []any{}, "has_more": false}), nil
					}
					return journalAgentTestResponse(map[string]any{"data": []any{
						map[string]any{"id": "report", "path": journalCuratorFailurePath, "turn_id": tc.reportTurn, "size_bytes": tc.size},
						map[string]any{"id": "private", "path": journalCuratorOutputPath, "turn_id": func() string {
							if tc.name == "final with output" {
								return "turn_current"
							}
							return "turn_old"
						}()},
					}, "has_more": false}), nil
				case "/v1/agents/sessions/sess_test/artifacts/report/content":
					if tc.reportTurn != "turn_current" || tc.size > journalCuratorFailureLimit {
						t.Fatal("read stale or oversized report")
					}
					return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
				default:
					t.Fatalf("unexpected request: %s", request.URL)
					return nil, errors.New("unexpected request")
				}
			})}
			curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
			result, err := curator.Collect(t.Context(), "sess_test")
			var terminal *journalCuratorTerminalError
			var incomplete *journalCuratorIncompleteError
			wantTerminal := tc.status != "idle" || (tc.name == "final" || tc.name == "final with output")
			if result != nil || (wantTerminal && !errors.As(err, &terminal)) || (!wantTerminal && !errors.As(err, &incomplete)) || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("result=%v error=%v; want classified diagnostic %q", result, err, tc.want)
			}
			if strings.Contains(err.Error(), "DO NOT READ") || strings.Contains(err.Error(), "private text") || strings.Contains(err.Error(), "\n") {
				t.Fatalf("unsafe diagnostic: %q", err)
			}
		})
	}
}
