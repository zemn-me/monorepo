package apiserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Exercise the HTTP date editor contract against published curation and durable
// storage, rather than testing the frontend's fallback label in isolation.
func TestJournalDateCorrectionPreservesRecordingTitles(t *testing.T) {
	server, curator, ctx, entries, now := journalKnowledgeFixture(t)
	result := journalKnowledgeResult(entries)
	for i := range result.Entries {
		result.Entries[i].Title = []string{"Planning the move", "A conversation with Kasimir"}[i]
	}
	curator.result = &result
	for _, at := range []time.Time{now, now.Add(5 * time.Minute)} {
		if err := server.RefreshJournalKnowledge(ctx, at); err != nil {
			t.Fatal(err)
		}
	}
	handler := Handler(NewStrictHandler(server, nil))
	request := func(method, path, body string, target any) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body)).WithContext(ctx)
		req.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != http.StatusOK {
			t.Fatalf("%s %s: %d %s", method, path, response.Code, response.Body.String())
		}
		if err := json.Unmarshal(response.Body.Bytes(), target); err != nil {
			t.Fatal(err)
		}
	}
	type recording struct {
		ID         string                     `json:"id"`
		Title      *string                    `json:"title"`
		RecordedAt time.Time                  `json:"recordedAt"`
		Summary    *JournalSummary            `json:"summary"`
		Transcript []JournalTranscriptSegment `json:"transcript"`
	}
	type diary struct {
		Entries []recording             `json:"entries"`
		Wiki    []JournalWikiIndexEntry `json:"wiki"`
	}
	var before diary
	request(http.MethodGet, "/journal", "", &before)
	wantTitles := map[string]string{}
	for _, entry := range before.Entries {
		if entry.Summary == nil {
			t.Fatal("fixture did not publish a titled analysis")
		}
		wantTitles[entry.ID] = entry.Summary.Title
	}
	for _, date := range []string{"2026-09-26", "2026-09-25"} {
		var edited recording
		request(http.MethodPatch, "/journal/entries/"+entries[0].Id, `{"recordedDate":"`+date+`"}`, &edited)
		if edited.Title == nil || *edited.Title != wantTitles[edited.ID] {
			t.Fatal("date editor response lost the edited recording's title")
		}
		var after diary
		request(http.MethodGet, "/journal", "", &after)
		if len(after.Entries) != len(before.Entries) {
			t.Fatal("date edit removed a recording")
		}
		for _, entry := range after.Entries {
			title := "Voice note"
			if entry.Title != nil {
				title = *entry.Title
			} else if entry.Summary != nil {
				title = entry.Summary.Title
			}
			if title != wantTitles[entry.ID] {
				t.Fatalf("after editing %s, recording %s became %q; want %q", entries[0].Id, entry.ID, title, wantTitles[entry.ID])
			}
			if entry.Summary != nil {
				t.Fatal("date correction retained stale analysis prose")
			}
			if len(entry.Transcript) == 0 {
				t.Fatal("date correction removed the original transcript")
			}
			if entry.ID == entries[0].Id && entry.RecordedAt.Format(time.DateOnly) != date {
				t.Fatalf("recording date = %s, want %s", entry.RecordedAt, date)
			}
		}
		if len(after.Wiki) != 0 {
			t.Fatal("date correction retained stale wiki prose")
		}
		_, matches, err := server.searchJournalMCP(ctx, nil, journalMCPFilter{})
		if err != nil || len(matches.Entries) != len(after.Entries) {
			t.Fatalf("read recordings through MCP: %#v %v", matches, err)
		}
		for _, match := range matches.Entries {
			if match.Title != wantTitles[match.ID] {
				t.Fatalf("MCP recording title = %q, want %q", match.Title, wantTitles[match.ID])
			}
			_, recording, err := server.getJournalEntryMCP(ctx, nil, journalMCPEntryArgs{ID: match.ID})
			if err != nil || recording.Title == nil || *recording.Title != match.Title || recording.Summary != nil {
				t.Fatalf("MCP recording did not retain only its label and original sources: %#v %v", recording, err)
			}
		}
	}
}
