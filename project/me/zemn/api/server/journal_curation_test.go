package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type fakeJournalCurator struct {
	corpus                   journalCorpus
	result                   *JournalCurationResult
	prepares, starts, cleans int
	failure                  error
}

func (f *fakeJournalCurator) Prepare(_ context.Context, _ string, data []byte) (string, error) {
	f.prepares++
	return "sess_test", json.Unmarshal(data, &f.corpus)
}
func (f *fakeJournalCurator) Start(context.Context, string, string) error { f.starts++; return nil }
func (f *fakeJournalCurator) Collect(context.Context, string) (*JournalCurationResult, error) {
	return f.result, f.failure
}
func (f *fakeJournalCurator) Cleanup(context.Context, string, string) error { f.cleans++; return nil }

type unavailableJournalAnalysis struct{ fakeJournalAI }

func (unavailableJournalAnalysis) AnalyzeEntry(context.Context, time.Time, string, []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	return JournalEntryAnalysisResult{}, fmt.Errorf("analysis unavailable")
}

func TestJournalKnowledgeUploadSurvivesProvisionalAnalysisFailure(t *testing.T) {
	for name, ai := range map[string]JournalAI{
		"unavailable":  unavailableJournalAnalysis{},
		"invalid date": inferredDateJournalAI{recordedDate: "not-a-date"},
	} {
		t.Run(name, func(t *testing.T) {
			s, _, ctx, _, now := journalKnowledgeFixture(t)
			s.journalAI = ai
			response, err := s.PostJournalEntries(ctx, PostJournalEntriesRequestObject{Body: &JournalEntryCreate{
				ContentType: "audio/mp4", RecordedAt: now, TimeZone: "UTC",
			}})
			if err != nil {
				t.Fatal(err)
			}
			id := response.(PostJournalEntries201JSONResponse).Entry.Id.String()
			audio := testMP4(now, 0)
			s.journalObjects.(*fakeJournalObjects).objects = map[string][]byte{journalEntryKey(id): audio}
			if err := s.ProcessJournalUpload(ctx, "journal", journalEntryKey(id), int64(len(audio))); err == nil {
				t.Fatal("missing analysis failure")
			}
			journalResponse, err := s.GetJournal(ctx, GetJournalRequestObject{})
			if err != nil {
				t.Fatal(err)
			}
			for _, entry := range journalResponse.(GetJournal200JSONResponse).Entries {
				if entry.Id.String() == id {
					if entry.Status != "ready" || len(entry.Transcript) == 0 {
						t.Fatalf("transcript unavailable after analysis failure: %#v", entry)
					}
					return
				}
			}
			t.Fatal("uploaded entry missing")
		})
	}
}

func journalKnowledgeFixture(t *testing.T) (*Server, *fakeJournalCurator, context.Context, []JournalStoredEntry, time.Time) {
	t.Helper()
	curator := &fakeJournalCurator{}
	s := &Server{ddb: &inMemoryDDB{}, journalTableName: "journal", journalBucketName: "journal", journalObjects: &fakeJournalObjects{}, journalPresigner: fakeJournalPresigner{}, journalAI: fakeJournalAI{}, journalCurator: curator, journalCurationEnabled: true}
	ctx := context.WithValue(t.Context(), auth.IDTokenKey, &auth.IDToken{Subject: journalOwnerSubject})
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	entries := []JournalStoredEntry{}
	for i, text := range []string{"I spoke to Cass about moving.", "Kasimir is the friend I meant yesterday when I talked about the move."} {
		entry := JournalStoredEntry{SchemaVersion: 1, Id: uuid.NewString(), RecordedAt: now.Add(time.Duration(i-2) * 24 * time.Hour), TimeZone: "UTC", Status: JournalEntryStatusReady, ContentType: "audio/wav", AudioKey: fmt.Sprintf("source-%d", i), Transcript: []JournalTranscriptSegment{{Id: "s0", Text: text, StartMs: 0, EndMs: 1500}}, DurationMs: 1500}
		if err := s.updateJournalEntry(ctx, journalOwnerSubject, entry); err != nil {
			t.Fatal(err)
		}
		entries = append(entries, entry)
	}
	return s, curator, ctx, entries, now
}

func journalKnowledgeResult(entries []JournalStoredEntry) JournalCurationResult {
	pageID := uuid.New()
	citations := []JournalCitation{}
	for _, entry := range entries {
		citations = append(citations, JournalCitation{EntryId: entry.Id, SegmentId: "s0", Quote: entry.Transcript[0].Text})
	}
	blocks := []JournalSummaryBlock{{Markdown: fmt.Sprintf("The move involved [Kasimir](/journal?wiki=%s).[^1] The following day's recording clarified the name.[^2]", pageID), Citations: citations}}
	result := JournalCurationResult{Pages: []JournalWikiPage{{Id: pageID, Title: "Kasimir", Kind: "person", Aliases: []string{"Cass"}, Blocks: blocks}}}
	for _, entry := range entries {
		result.Entries = append(result.Entries, JournalCuratedEntry{EntryId: uuid.MustParse(entry.Id), Title: "The move", Blocks: blocks})
	}
	return result
}

func TestJournalKnowledgePublishesCrossDateWikiAndAnalyses(t *testing.T) {
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	if err := s.RefreshJournalKnowledge(ctx, now); err != nil {
		t.Fatal(err)
	}
	if curator.prepares != 1 || curator.starts != 1 || len(curator.corpus.Entries) != 2 {
		t.Fatalf("missing corpus or start: %#v", curator)
	}
	if curator.corpus.OutputSchema == nil {
		t.Fatal("missing output contract")
	}
	response, err := s.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	if response.(GetJournal200JSONResponse).Curation.Status != "running" {
		t.Fatal("missing running status")
	}
	// Another schedule tick reconciles the same run without starting more work.
	if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if curator.starts != 1 {
		t.Fatal("duplicate start")
	}
	result := journalKnowledgeResult(entries)
	curator.result = &result
	if err := s.RefreshJournalKnowledge(ctx, now.Add(10*time.Minute)); err != nil {
		t.Fatal(err)
	}
	response, err = s.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if journal.Curation.Status != "ready" || journal.Wiki == nil || len(*journal.Wiki) != 1 {
		t.Fatalf("not published: %#v", journal)
	}
	for _, entry := range journal.Entries {
		if entry.Summary == nil || len(entry.Summary.Blocks[0].Citations) != 2 {
			t.Fatal("entry lacks cross-date analysis")
		}
	}
	page, err := s.GetJournalWikiPageId(ctx, GetJournalWikiPageIdRequestObject{PageId: result.Pages[0].Id})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := page.(GetJournalWikiPageId200JSONResponse); !ok {
		t.Fatalf("missing wiki page: %T", page)
	}
	_, search, err := s.searchJournalWikiMCP(ctx, nil, journalWikiMCPFilter{Query: "Cass"})
	if err != nil || len(search.Pages) != 1 {
		t.Fatalf("wiki MCP search: %#v %v", search, err)
	}
	_, mcpEntry, err := s.getJournalEntryMCP(ctx, nil, journalMCPEntryArgs{ID: entries[0].Id})
	if err != nil || mcpEntry.Summary == nil || len(mcpEntry.Summary.Blocks[0].Citations) != 2 {
		t.Fatalf("MCP analysis: %#v %v", mcpEntry, err)
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(15*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if curator.cleans != 1 {
		t.Fatal("session not cleaned up")
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if curator.starts != 1 {
		t.Fatal("unchanged corpus triggered paid work")
	}
}

func TestJournalKnowledgeRejectsInvalidEvidenceAndLinks(t *testing.T) {
	_, _, _, entries, _ := journalKnowledgeFixture(t)
	records := []JournalStoredRecord{{Entry: &entries[0]}, {Entry: &entries[1]}}
	corpus := journalCorpusFromRecords(records)
	valid := journalKnowledgeResult(entries)
	valid.Pages[0].Blocks[0].Markdown = "Later evidence clarified the name.[^1][^2]"
	if err := validateJournalCuration(valid, corpus); err != nil {
		t.Fatalf("adjacent citations: %v", err)
	}
	for _, test := range []struct {
		name   string
		mutate func(*JournalCurationResult)
	}{
		{"fabricated quote", func(r *JournalCurationResult) { r.Entries[0].Blocks[0].Citations[0].Quote = "invented" }},
		{"unknown source", func(r *JournalCurationResult) { r.Pages[0].Blocks[0].Citations[0].EntryId = uuid.NewString() }},
		{"missing entry", func(r *JournalCurationResult) { r.Entries = r.Entries[:1] }},
		{"duplicate entry", func(r *JournalCurationResult) { r.Entries[1].EntryId = r.Entries[0].EntryId }},
		{"duplicate page", func(r *JournalCurationResult) { r.Pages = append(r.Pages, r.Pages[0]) }},
		{"unknown wiki page", func(r *JournalCurationResult) { r.Pages[0].Blocks[0].Markdown += " [unknown](/journal?wiki=missing)" }},
		{"external link", func(r *JournalCurationResult) { r.Pages[0].Blocks[0].Markdown += " [external](https://example.com)" }},
		{"reference link", func(r *JournalCurationResult) { r.Pages[0].Blocks[0].Markdown += " [external][destination]" }},
		{"invalid footnote", func(r *JournalCurationResult) { r.Pages[0].Blocks[0].Markdown += "[^99]" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			result := journalKnowledgeResult(entries)
			test.mutate(&result)
			if validateJournalCuration(result, corpus) == nil {
				t.Fatal("invalid output accepted")
			}
		})
	}
}

func TestJournalKnowledgeDeletionHidesDerivedContentEverywhere(t *testing.T) {
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	result := journalKnowledgeResult(entries)
	curator.result = &result
	for _, at := range []time.Time{now, now.Add(5 * time.Minute)} {
		if err := s.RefreshJournalKnowledge(ctx, at); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.DeleteJournalEntriesEntryId(ctx, DeleteJournalEntriesEntryIdRequestObject{EntryId: uuid.MustParse(entries[0].Id)}); err != nil {
		t.Fatal(err)
	}
	response, err := s.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if len(*journal.Wiki) != 0 || journal.Entries[0].Summary != nil {
		t.Fatal("deleted evidence remains visible")
	}
	page, err := s.GetJournalWikiPageId(ctx, GetJournalWikiPageIdRequestObject{PageId: result.Pages[0].Id})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := page.(GetJournalWikiPageId404JSONResponse); !ok {
		t.Fatal("deleted evidence retained in wiki endpoint")
	}
	_, search, err := s.searchJournalWikiMCP(ctx, nil, journalWikiMCPFilter{})
	if err != nil || len(search.Pages) != 0 {
		t.Fatal("deleted evidence retained in MCP")
	}
}

func TestJournalKnowledgeChangedSourceCannotPublish(t *testing.T) {
	s, curator, ctx, entries, now := journalKnowledgeFixture(t)
	if err := s.RefreshJournalKnowledge(ctx, now); err != nil {
		t.Fatal(err)
	}
	result := journalKnowledgeResult(entries)
	curator.result = &result
	entries[0].RecordedAt = now
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[0]); err != nil {
		t.Fatal(err)
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err != nil {
		t.Fatal(err)
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.PublishedKey != "" || !state.Cleaning {
		t.Fatalf("stale result published: %#v", state)
	}
}

func TestJournalKnowledgeFailureDoesNotHideTranscript(t *testing.T) {
	s, curator, ctx, _, now := journalKnowledgeFixture(t)
	if err := s.RefreshJournalKnowledge(ctx, now); err != nil {
		t.Fatal(err)
	}
	curator.failure = &journalCuratorTerminalError{reason: "failed"}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err == nil {
		t.Fatal("missing failure")
	}
	response, err := s.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if journal.Curation.Status != "failed" || len(journal.Entries) != 2 || len(journal.Entries[0].Transcript) == 0 {
		t.Fatal("curator failure damaged source availability")
	}
}

func TestJournalKnowledgeOwnershipAndStateFencing(t *testing.T) {
	s, _, ctx, _, _ := journalKnowledgeFixture(t)
	other := context.WithValue(ctx, auth.IDTokenKey, &auth.IDToken{Subject: "other"})
	if _, err := s.GetJournalWikiPageId(other, GetJournalWikiPageIdRequestObject{PageId: uuid.New()}); err == nil {
		t.Fatal("non-owner can read wiki")
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	stale := state
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
	if err := s.saveJournalCurationState(ctx, &stale); err == nil {
		t.Fatal("stale coordinator acquired state")
	}
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
}
