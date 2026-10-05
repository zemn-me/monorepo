package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
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

type transcriptionOnlyJournalAI struct {
	fakeJournalAI
	t *testing.T
}

func (ai transcriptionOnlyJournalAI) AnalyzeEntry(context.Context, time.Time, string, []JournalSummarySource) (JournalEntryAnalysisResult, error) {
	ai.t.Fatal("upload called per-entry analysis")
	return JournalEntryAnalysisResult{}, nil
}

func (ai transcriptionOnlyJournalAI) Summarize(context.Context, string, []JournalSummarySource) (JournalSummaryResult, error) {
	ai.t.Fatal("upload called aggregate summarization")
	return JournalSummaryResult{}, nil
}

func TestJournalKnowledgeUploadOnlyTranscribes(t *testing.T) {
	s, _, ctx, _, now := journalKnowledgeFixture(t)
	s.journalAI = transcriptionOnlyJournalAI{t: t}
	response, err := s.PostJournalEntries(ctx, PostJournalEntriesRequestObject{Body: &JournalEntryCreate{
		ContentType: "audio/mp4", RecordedAt: now, TimeZone: "UTC",
	}})
	if err != nil {
		t.Fatal(err)
	}
	id := response.(PostJournalEntries201JSONResponse).Entry.Id.String()
	embeddedDate := now.Add(-48 * time.Hour)
	audio := testMP4(embeddedDate, 0)
	s.journalObjects.(*fakeJournalObjects).objects = map[string][]byte{journalEntryKey(id): audio}
	for range 2 {
		if err := s.ProcessJournalUpload(ctx, "journal", journalEntryKey(id), int64(len(audio))); err != nil {
			t.Fatal(err)
		}
	}
	journalResponse, err := s.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range journalResponse.(GetJournal200JSONResponse).Entries {
		if entry.Id.String() == id {
			if entry.Status != "ready" || len(entry.Transcript) == 0 || entry.Summary != nil || entry.ProcessingProgress != nil || !entry.RecordedAt.Equal(embeddedDate) {
				t.Fatalf("unexpected transcribed entry: %#v", entry)
			}
			return
		}
	}
	t.Fatal("uploaded entry missing")
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
	if len(journal.Summaries) != 0 {
		t.Fatal("curation published calendar articles")
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

// Observe every write, including a delete followed by recreation of identical
// bytes, which a final-state comparison alone would miss.
type journalCurationObservedObjects struct {
	*fakeJournalObjects
	writes, deletes []string
}

func (o *journalCurationObservedObjects) PutObject(ctx context.Context, input *s3.PutObjectInput, options ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	o.writes = append(o.writes, *input.Key)
	return o.fakeJournalObjects.PutObject(ctx, input, options...)
}

func (o *journalCurationObservedObjects) DeleteObject(ctx context.Context, input *s3.DeleteObjectInput, options ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	o.deletes = append(o.deletes, *input.Key)
	return o.fakeJournalObjects.DeleteObject(ctx, input, options...)
}

func TestJournalKnowledgeBackfillPreservesExistingDiary(t *testing.T) {
	for _, outcome := range []string{"published", "invalid output", "agent failure", "timeout"} {
		t.Run(outcome, func(t *testing.T) {
			s, curator, ctx, entries, now := journalKnowledgeFixture(t)
			objects := s.journalObjects.(*fakeJournalObjects)
			for i := range entries {
				entry := &entries[i]
				entry.AudioKey = journalEntryKey(entry.Id)
				entry.ContentSha256 = fmt.Sprintf("%064x", i+1)
				citation := JournalCitation{EntryId: entry.Id, SegmentId: "s0", Quote: entry.Transcript[0].Text}
				entry.Summary = ptr(summaryRecord("entry:"+entry.Id, JournalSummaryPeriodEntry, entry.RecordedAt, entry.RecordedAt, JournalSummaryResult{
					Title: "Original entry summary", Blocks: []JournalSummaryBlock{{Markdown: "The move.[^1]", Citations: []JournalCitation{citation}}},
				}, "original"))
				if err := s.updateJournalEntry(ctx, journalOwnerSubject, *entry); err != nil {
					t.Fatal(err)
				}
				objects.objects[entry.AudioKey] = []byte{0, 1, 2, byte(i), 255}
				if owned, err := s.claimJournalContentHash(ctx, journalOwnerSubject, entry.Id, entry.ContentSha256); err != nil || !owned {
					t.Fatalf("seed content hash: %v %v", owned, err)
				}
			}
			legacy := *entries[0].Summary
			legacy.Id, legacy.Period = "old-day-summary", JournalSummaryPeriodDay
			if err := s.putJournalRecord(ctx, JournalStoredRecord{Id: journalOwnerSubject, When: "SUMMARY#day", Kind: JournalStoredRecordKindSummary, Summary: &legacy}); err != nil {
				t.Fatal(err)
			}
			if err := s.putJournalJSON(ctx, journalAggregateObjectKey(legacy.Period, legacy.Start), legacy); err != nil {
				t.Fatal(err)
			}
			originalObjects := map[string][]byte{}
			for key, data := range objects.objects {
				originalObjects[key] = bytes.Clone(data)
			}
			diaryRecords := func() map[string]string {
				records := map[string]string{}
				for _, item := range s.ddb.(*inMemoryDDB).journal {
					if keyTableRecordWhen(item) == journalCurationKey {
						continue
					}
					data, err := json.Marshal(item)
					if err != nil {
						t.Fatal(err)
					}
					records[keyTableRecordID(item)+"/"+keyTableRecordWhen(item)] = string(data)
				}
				return records
			}
			originalRecords := diaryRecords()
			observed := &journalCurationObservedObjects{fakeJournalObjects: objects}
			s.journalObjects = observed
			if err := s.RefreshJournalKnowledge(ctx, now); err != nil {
				t.Fatal(err)
			}
			state, err := s.readJournalCurationState(ctx)
			if err != nil || state.PublishedKey != "" || state.InputKey == "" {
				t.Fatalf("expected first backfill with no published generation: %#v %v", state, err)
			}
			inputKey := state.InputKey
			result := journalKnowledgeResult(entries)
			curator.result = &result
			collectAt := now.Add(5 * time.Minute)
			switch outcome {
			case "invalid output":
				result.Entries = nil
			case "agent failure":
				curator.failure = &journalCuratorTerminalError{reason: "failed"}
			case "timeout":
				collectAt = now.Add(121 * time.Minute)
			}
			err = s.RefreshJournalKnowledge(ctx, collectAt)
			wantError := outcome == "invalid output" || outcome == "agent failure"
			if (err != nil) != wantError {
				t.Fatalf("collect: %v", err)
			}
			if err := s.RefreshJournalKnowledge(ctx, collectAt.Add(5*time.Minute)); err != nil {
				t.Fatal(err)
			}
			state, err = s.readJournalCurationState(ctx)
			if err != nil || (state.PublishedKey != "") != (outcome == "published") || curator.cleans != 1 {
				t.Fatalf("unexpected publication/cleanup: %#v %v", state, err)
			}
			response, err := s.GetJournal(ctx, GetJournalRequestObject{})
			if err != nil || len(response.(GetJournal200JSONResponse).Entries) != len(entries) {
				t.Fatalf("entries unavailable after backfill: %v", err)
			}
			for key, before := range originalObjects {
				after, exists := objects.objects[key]
				if !exists || !bytes.Equal(before, after) {
					t.Errorf("original object changed or deleted: %s", key)
				}
			}
			if !reflect.DeepEqual(originalRecords, diaryRecords()) {
				t.Fatal("backfill changed existing diary records")
			}
			for _, key := range observed.writes {
				if !strings.HasPrefix(key, "curation/") {
					t.Errorf("curator wrote outside derived artifacts: %s", key)
				}
			}
			if !reflect.DeepEqual(observed.deletes, []string{inputKey}) {
				t.Fatalf("cleanup deleted objects other than its temporary input: %v", observed.deletes)
			}
		})
	}
}

func TestJournalKnowledgeCleanupRejectsUnexpectedObjectKeys(t *testing.T) {
	for _, target := range []string{"audio", "transcript", "another run", "generation", "invalid run ID"} {
		t.Run(target, func(t *testing.T) {
			s, curator, ctx, entries, now := journalKnowledgeFixture(t)
			runID := uuid.NewString()
			key := journalCurationInputKey(runID)
			switch target {
			case "audio":
				key = journalEntryKey(entries[0].Id)
			case "transcript":
				key = "entries/" + entries[0].Id + "/transcript.json"
			case "another run":
				key = journalCurationInputKey(uuid.NewString())
			case "generation":
				key = "curation/generations/" + runID + ".json"
			case "invalid run ID":
				runID = "../originals"
				key = journalCurationInputKey(runID)
			}
			objects := &journalCurationObservedObjects{fakeJournalObjects: s.journalObjects.(*fakeJournalObjects)}
			s.journalObjects = objects
			objects.objects[key] = []byte("preserve this object")
			state := journalCurationState{ID: journalOwnerSubject, When: journalCurationKey, RunID: runID, InputKey: key, Cleaning: true}
			if err := s.saveJournalCurationState(ctx, &state); err != nil {
				t.Fatal(err)
			}
			if err := s.RefreshJournalKnowledge(ctx, now); err == nil {
				t.Fatal("cleanup accepted an unexpected object key")
			}
			if len(objects.deletes) != 0 || curator.cleans != 0 || string(objects.objects[key]) != "preserve this object" {
				t.Fatal("unsafe cleanup performed a deletion")
			}
		})
	}
}

func TestJournalKnowledgeDailyAttempts(t *testing.T) {
	for _, outcome := range []string{"agent failure", "invalid output", "timeout"} {
		t.Run(outcome, func(t *testing.T) {
			s, curator, ctx, entries, now := journalKnowledgeFixture(t)
			for attempt := range 3 {
				at := now.Add(time.Duration(attempt) * 3 * time.Hour)
				if err := s.RefreshJournalKnowledge(ctx, at); err != nil {
					t.Fatal(err)
				}
				if curator.starts != attempt+1 {
					t.Fatalf("attempt %d: starts = %d", attempt+1, curator.starts)
				}
				failedAt := at.Add(5 * time.Minute)
				switch outcome {
				case "agent failure":
					curator.failure = &journalCuratorTerminalError{reason: "failed"}
				case "invalid output":
					curator.result = &JournalCurationResult{}
				case "timeout":
					failedAt = at.Add(125 * time.Minute)
				}
				err := s.RefreshJournalKnowledge(ctx, failedAt)
				if (err != nil) != (outcome != "timeout") {
					t.Fatalf("failure result: %v", err)
				}
				if err := s.RefreshJournalKnowledge(ctx, failedAt.Add(5*time.Minute)); err != nil {
					t.Fatal(err)
				}
				if outcome != "timeout" {
					if err := s.RefreshJournalKnowledge(ctx, failedAt.Add(10*time.Minute)); err != nil {
						t.Fatal(err)
					}
				}
				if curator.starts != attempt+1 {
					t.Fatal("failure retried before hourly backoff or daily cap")
				}
			}
			// Uploading another source must not reset the exhausted budget.
			entries[0].Transcript[0].Text = "Changed source."
			if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[0]); err != nil {
				t.Fatal(err)
			}
			for at := now.Add(9 * time.Hour); at.Before(now.Add(24 * time.Hour)); at = at.Add(5 * time.Minute) {
				if err := s.RefreshJournalKnowledge(ctx, at); err != nil {
					t.Fatal(err)
				}
			}
			if curator.starts != 3 {
				t.Fatalf("daily budget exceeded: %d", curator.starts)
			}
			state, err := s.readJournalCurationState(ctx)
			if err != nil || state.Attempts != 3 || !state.AttemptWindowStart.Equal(now) {
				t.Fatalf("budget not durable: %#v %v", state, err)
			}
			if err := s.RefreshJournalKnowledge(ctx, now.Add(24*time.Hour)); err != nil {
				t.Fatal(err)
			}
			if curator.starts != 4 {
				t.Fatal("next day's attempt did not start")
			}
		})
	}
}

func TestJournalKnowledgeSuccessWaitsUntilNextDay(t *testing.T) {
	for _, retry := range []bool{false, true} {
		t.Run(fmt.Sprint("retry=", retry), func(t *testing.T) {
			s, curator, ctx, entries, now := journalKnowledgeFixture(t)
			if err := s.RefreshJournalKnowledge(ctx, now); err != nil {
				t.Fatal(err)
			}
			at := now
			if retry {
				curator.failure = &journalCuratorTerminalError{reason: "failed"}
				if err := s.RefreshJournalKnowledge(ctx, now.Add(5*time.Minute)); err == nil {
					t.Fatal("missing failure")
				}
				if err := s.RefreshJournalKnowledge(ctx, now.Add(10*time.Minute)); err != nil {
					t.Fatal(err)
				}
				curator.failure = nil
				at = now.Add(time.Hour)
				if err := s.RefreshJournalKnowledge(ctx, at); err != nil {
					t.Fatal(err)
				}
			}
			result := journalKnowledgeResult(entries)
			curator.result = &result
			for _, tick := range []time.Time{at.Add(5 * time.Minute), at.Add(10 * time.Minute)} {
				if err := s.RefreshJournalKnowledge(ctx, tick); err != nil {
					t.Fatal(err)
				}
			}
			starts := curator.starts
			entries[0].RecordedAt = now
			if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[0]); err != nil {
				t.Fatal(err)
			}
			for tick := now.Add(2 * time.Hour); tick.Before(now.Add(24 * time.Hour)); tick = tick.Add(5 * time.Minute) {
				if err := s.RefreshJournalKnowledge(ctx, tick); err != nil {
					t.Fatal(err)
				}
			}
			if curator.starts != starts {
				t.Fatal("changed sources triggered another run after success")
			}
			if err := s.RefreshJournalKnowledge(ctx, now.Add(24*time.Hour)); err != nil {
				t.Fatal(err)
			}
			if curator.starts != starts+1 {
				t.Fatal("changed sources did not start next day")
			}
		})
	}
}

func TestJournalKnowledgeExistingCheckpointCountsAsAttempt(t *testing.T) {
	s, curator, ctx, _, now := journalKnowledgeFixture(t)
	state := journalCurationState{ID: journalOwnerSubject, When: journalCurationKey, StartedAt: now}
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if curator.starts != 0 {
		t.Fatal("existing successful attempt ignored")
	}
	state, err := s.readJournalCurationState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	state.Failed = true
	if err := s.saveJournalCurationState(ctx, &state); err != nil {
		t.Fatal(err)
	}
	if err := s.RefreshJournalKnowledge(ctx, now.Add(3*time.Hour)); err != nil {
		t.Fatal(err)
	}
	state, err = s.readJournalCurationState(ctx)
	if err != nil || state.Attempts != 2 || curator.starts != 1 {
		t.Fatalf("legacy failed attempt not counted: %#v %v", state, err)
	}
}
