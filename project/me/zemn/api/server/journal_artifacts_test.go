package apiserver

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	openai "github.com/openai/openai-go/v3"
)

func TestJournalAgentsPublishBatchesAcrossTurns(t *testing.T) {
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	want := journalKnowledgeResult(entries)
	first := JournalCurationResult{Entries: want.Entries[:1], Pages: []JournalWikiPage{}}
	second := JournalCurationResult{Entries: want.Entries[1:], Pages: want.Pages, DateCorrections: want.DateCorrections}
	firstPath := journalCuratorPartsDirectory + "/0001.json"
	secondPath := journalCuratorPartsDirectory + "/0002.json"
	submissions := 0
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		switch request.Method + " " + request.URL.Path {
		case "GET /v1/agents/sessions":
			return journalAgentTestResponse(map[string]any{"data": []any{}, "has_more": false}), nil
		case "POST /v1/agents/sessions":
			return journalAgentTestResponse(map[string]any{"id": "sess_batches", "status": "idle"}), nil
		case "POST /v1/agents/sessions/sess_batches/events":
			submissions++
			return journalAgentTestResponse(nil), nil
		case "GET /v1/agents/sessions/sess_batches":
			return journalAgentTestResponse(map[string]any{"id": "sess_batches", "status": "idle"}), nil
		case "GET /v1/agents/sessions/sess_batches/turns":
			return journalAgentTestResponse(map[string]any{"data": []any{map[string]any{"id": fmt.Sprintf("turn_%d", submissions), "status": "completed"}}}), nil
		case "GET /v1/agents/sessions/sess_batches/artifacts":
			artifacts := []any{map[string]any{"id": "first", "path": firstPath, "turn_id": "turn_1", "created_at": 1}}
			if submissions > 1 {
				artifacts = append(artifacts,
					map[string]any{"id": "manifest", "path": journalCuratorManifestPath, "turn_id": "turn_2", "created_at": 2},
					map[string]any{"id": "second", "path": secondPath, "turn_id": "turn_2", "created_at": 2},
					// A draft is not part of the manifest and must never be downloaded.
					map[string]any{"id": "draft", "path": journalCuratorPartsDirectory + "/draft.json", "turn_id": "turn_2"})
			}
			return journalAgentTestResponse(map[string]any{"data": artifacts, "has_more": false}), nil
		case "GET /v1/agents/sessions/sess_batches/artifacts/manifest/content":
			return journalAgentTestResponse(journalCuratorManifest{Parts: []string{firstPath, secondPath}}), nil
		case "GET /v1/agents/sessions/sess_batches/artifacts/first/content":
			return journalAgentTestResponse(first), nil
		case "GET /v1/agents/sessions/sess_batches/artifacts/second/content":
			return journalAgentTestResponse(second), nil
		default:
			return nil, fmt.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
		}
	})}
	s.journalCurator = &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}, model: "test-model"}
	for _, minutes := range []int{0, 5, 10} {
		if err := s.RefreshJournalKnowledge(ctx, now.Add(time.Duration(minutes)*time.Minute)); err != nil {
			t.Fatal(err)
		}
		state, err := s.readJournalCurationState(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if minutes < 10 && state.PublishedKey != "" {
			t.Fatal("published incomplete batches without a completion manifest")
		}
		if minutes == 10 {
			if state.PublishedKey == "" || state.Failed || state.Attempts != 1 || submissions != 2 {
				t.Fatalf("batches not published in one run: %#v submissions=%d", state, submissions)
			}
			var generation journalGeneration
			if err := s.readJournalCurationJSON(ctx, state.PublishedKey, &generation); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(generation.Result, want) {
				t.Fatalf("accumulation changed generation: %#v", generation.Result)
			}
		}
	}
}

func TestJournalBatchManifestValidation(t *testing.T) {
	_, _, _, entries, _ := journalKnowledgeFixture(t)
	want := journalKnowledgeResult(entries)
	partPath := journalCuratorPartsDirectory + "/0001.json"
	for _, tc := range []struct {
		name              string
		parts             []string
		artifacts         []openai.SessionArtifact
		body              string
		metadataSize      int64
		wantError         string
		invalidGeneration bool
	}{
		{name: "success", parts: []string{partPath}},
		{name: "current version", parts: []string{partPath}, artifacts: []openai.SessionArtifact{{ID: "old", Path: partPath, TurnID: "old", CreatedAt: 3}, {ID: "part", Path: partPath, TurnID: "current", CreatedAt: 2}}},
		{name: "latest previous version", parts: []string{partPath}, artifacts: []openai.SessionArtifact{{ID: "old", Path: partPath, TurnID: "older", CreatedAt: 1}, {ID: "part", Path: partPath, TurnID: "old", CreatedAt: 2}}},
		{name: "ambiguous versions", parts: []string{partPath}, artifacts: []openai.SessionArtifact{{ID: "old", Path: partPath, TurnID: "old", CreatedAt: 2}, {ID: "part", Path: partPath, TurnID: "other", CreatedAt: 2}}, wantError: "version ambiguous"},
		{name: "empty", wantError: "part count"},
		{name: "too many", parts: make([]string, journalCuratorMaxParts+1), wantError: "part count"},
		{name: "duplicate path", parts: []string{partPath, partPath}, wantError: "duplicate journal manifest"},
		{name: "traversal", parts: []string{journalCuratorPartsDirectory + "/../failure.json"}, wantError: "part path"},
		{name: "unrelated file", parts: []string{journalCuratorFailurePath}, wantError: "part path"},
		{name: "missing", parts: []string{journalCuratorPartsDirectory + "/missing.json"}, wantError: "part missing"},
		{name: "malformed private output", parts: []string{partPath}, body: `{"private diary text":true}`, wantError: "unknown JSON field"},
		{name: "wrong schema", parts: []string{partPath}, body: `{"entries":null,"pages":[]}`, wantError: "violates schema"},
		{name: "oversized metadata", parts: []string{partPath}, metadataSize: journalCurationMaxBytes, wantError: "size limit"},
		{name: "oversized manifest body", body: strings.Repeat(" ", journalCuratorManifestLimit+1), wantError: "size limit"},
		{name: "duplicate entry IDs", parts: []string{partPath}, invalidGeneration: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			artifacts := tc.artifacts
			if artifacts == nil {
				artifacts = []openai.SessionArtifact{{ID: "part", Path: partPath, TurnID: "old", SizeBytes: tc.metadataSize}}
			}
			output := want
			if tc.invalidGeneration {
				output.Entries = append(append([]JournalCuratedEntry{}, want.Entries...), want.Entries[0])
			}
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				switch request.URL.Path {
				case "/v1/agents/sessions/test/artifacts/manifest/content":
					if tc.name == "oversized manifest body" {
						return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
					}
					return journalAgentTestResponse(journalCuratorManifest{Parts: tc.parts}), nil
				case "/v1/agents/sessions/test/artifacts/part/content":
					if tc.body != "" {
						return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
					}
					return journalAgentTestResponse(output), nil
				default:
					return nil, errors.New("downloaded an unselected artifact")
				}
			})}
			curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
			result, err := curator.collectJournalParts(context.Background(), "test", "current", openai.SessionArtifact{ID: "manifest"}, artifacts)
			if tc.wantError != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantError) || strings.Contains(err.Error(), "private diary text") {
					t.Fatalf("unexpected diagnostic %v; want %q", err, tc.wantError)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			corpus := journalCorpusFromRecords([]JournalStoredRecord{{Entry: &entries[0]}, {Entry: &entries[1]}})
			if err := validateJournalCuration(*result, corpus); (err != nil) != tc.invalidGeneration {
				t.Fatalf("aggregate validation: %v", err)
			}
		})
	}
}

func TestJournalBatchByteLimitUsesActualBodies(t *testing.T) {
	// Exercise the streaming bound independently of potentially inaccurate metadata.
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(strings.Repeat(" ", 101)))}, nil
	})}
	curator := &openAIJournalCurator{ai: &openAIJournalAI{apiKey: "test", client: client}}
	var result journalCuratorManifest
	if _, err := curator.readJournalArtifact(t.Context(), "test", openai.SessionArtifact{ID: "part"}, 100, &result); err == nil || !strings.Contains(err.Error(), "size limit") {
		t.Fatalf("actual body bypassed limit: %v", err)
	}
}
