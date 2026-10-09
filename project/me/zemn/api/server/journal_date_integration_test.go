package apiserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

// Exercise the HTTP date editor contract against published curation and durable
// storage, rather than testing the frontend's fallback label in isolation.
func TestJournalDateCorrectionPreservesPublishedKnowledge(t *testing.T) {
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
	wantBlocks := map[string][]JournalSummaryBlock{}
	for _, entry := range before.Entries {
		if entry.Summary == nil {
			t.Fatal("fixture did not publish a titled analysis")
		}
		wantTitles[entry.ID] = entry.Summary.Title
		wantBlocks[entry.ID] = entry.Summary.Blocks
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
			if entry.Summary == nil || !reflect.DeepEqual(entry.Summary.Blocks, wantBlocks[entry.ID]) {
				t.Fatal("date correction discarded published recording analysis")
			}
			if !entry.Summary.Start.Equal(entry.RecordedAt) {
				t.Fatal("preserved analysis did not follow the corrected recording date")
			}
			if len(entry.Transcript) == 0 {
				t.Fatal("date correction removed the original transcript")
			}
			if entry.ID == entries[0].Id && entry.RecordedAt.Format(time.DateOnly) != date {
				t.Fatalf("recording date = %s, want %s", entry.RecordedAt, date)
			}
		}
		if !reflect.DeepEqual(after.Wiki, before.Wiki) {
			t.Fatal("date correction discarded published wiki pages")
		}
		var page JournalWikiPage
		request(http.MethodGet, "/journal/wiki/"+result.Pages[0].Id.String(), "", &page)
		if !reflect.DeepEqual(page, result.Pages[0]) {
			t.Fatal("date correction changed the published wiki page")
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
			if err != nil || recording.Title == nil || *recording.Title != match.Title || recording.Summary == nil || !reflect.DeepEqual(recording.Summary.Blocks, wantBlocks[match.ID]) {
				t.Fatalf("MCP recording did not retain its published analysis: %#v %v", recording, err)
			}
		}
	}
}

// Curator date corrections use the same public diary surfaces as manual edits.
func TestJournalCuratorCorrectsRecordingDateWithoutLosingKnowledge(t *testing.T) {
	server, curator, ctx, entries, now := journalKnowledgeFixture(t)
	result := journalKnowledgeResult(entries)
	entries[0].TimeZone = "America/Los_Angeles"
	entries[0].Transcript[0].Text = "This recording is for September 25, 2026. I spoke to Cass about moving."
	if err := server.updateJournalEntry(ctx, journalOwnerSubject, entries[0]); err != nil {
		t.Fatal(err)
	}
	result = journalKnowledgeResult(entries)
	curator.result = &result
	for _, at := range []time.Time{now, now.Add(5 * time.Minute), now.Add(10 * time.Minute)} {
		if err := server.RefreshJournalKnowledge(ctx, at); err != nil {
			t.Fatal(err)
		}
	}
	result.DateCorrections = []JournalCuratedDateCorrection{{
		EntryId: result.Entries[0].EntryId, RecordedDate: "2026-09-25",
		Citations: []JournalCitation{{EntryId: entries[0].Id, SegmentId: "s0", Quote: entries[0].Transcript[0].Text}},
	}}
	// A user edit makes the corpus eligible for another curation; that later
	// complete generation can correct another previously published recording.
	entries[1].RecordedAt = entries[1].RecordedAt.Add(24 * time.Hour)
	if err := server.updateJournalEntry(ctx, journalOwnerSubject, entries[1]); err != nil {
		t.Fatal(err)
	}
	for _, at := range []time.Time{now.Add(25 * time.Hour), now.Add(25*time.Hour + 5*time.Minute)} {
		if err := server.RefreshJournalKnowledge(ctx, at); err != nil {
			t.Fatal(err)
		}
	}

	handler := Handler(NewStrictHandler(server, nil))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/journal", nil).WithContext(ctx))
	if response.Code != http.StatusOK {
		t.Fatalf("GET journal: %d", response.Code)
	}
	var diary GetJournal200JSONResponse
	if err := json.Unmarshal(response.Body.Bytes(), &diary); err != nil {
		t.Fatal(err)
	}
	if len(diary.Entries) != len(entries) || (diary.Wiki == nil || len(*diary.Wiki) != len(result.Pages)) {
		t.Fatal("curator correction lost published knowledge")
	}
	for _, entry := range diary.Entries {
		if entry.Summary == nil || entry.Title == nil || *entry.Title != "The move" || len(entry.Summary.Blocks) == 0 {
			t.Fatal("curator correction lost a recording's analysis or title")
		}
		if !entry.Summary.Start.Equal(entry.RecordedAt) {
			t.Fatal("analysis period did not follow date correction")
		}
		if entry.Id.String() == entries[0].Id {
			location, err := time.LoadLocation("America/Los_Angeles")
			if err != nil {
				t.Fatal(err)
			}
			if got := entry.RecordedAt.In(location).Format(time.DateOnly); got != "2026-09-25" {
				t.Fatalf("curator left recording date at %s", got)
			}
			if entry.RecordedAt.In(location).Hour() != entries[0].RecordedAt.In(location).Hour() {
				t.Fatal("date correction changed recording's local time")
			}
		}
	}
	for _, page := range result.Pages {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/journal/wiki/"+page.Id.String(), nil).WithContext(ctx))
		if response.Code != http.StatusOK {
			t.Fatalf("wiki unavailable after date correction: %d", response.Code)
		}
	}
	records, err := server.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	_, fingerprint := journalCorpusHashes(journalCorpusFromRecords(records))
	state, err := server.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.PublishedFingerprint != fingerprint {
		t.Fatal("curator dates made its own generation dirty")
	}
}
