package apiserver

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type fakeJournalObjects struct {
	put bool
}

func (f *fakeJournalObjects) PutObject(_ context.Context, _ *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	f.put = true
	return &s3.PutObjectOutput{}, nil
}

type fakeJournalAI struct{}

func (fakeJournalAI) Transcribe(_ context.Context, _ []byte, _ string) ([]journalTranscriptSegment, error) {
	return []journalTranscriptSegment{{
		ID:           "s0",
		StartSeconds: 0,
		EndSeconds:   1.5,
		Text:         "Today I planted rosemary.",
	}}, nil
}

func (fakeJournalAI) Summarize(_ context.Context, period string, sources []journalSummarySource) (journalSummaryResult, error) {
	var citations []journalCitation
	for _, source := range sources {
		citations = append(citations, source.Citations...)
	}
	return journalSummaryResult{
		Title:     period + " theme",
		Body:      "A reflection grounded in the transcript.",
		Themes:    []string{"gardening"},
		Citations: citations,
	}, nil
}

func TestJournalPeriodBoundsUseRequestedTimeZone(t *testing.T) {
	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, time.July, 26, 23, 30, 0, 0, time.UTC)
	start, end := periodBounds(at, location, "day")

	if got, want := start.Format(time.RFC3339), "2026-07-26T07:00:00Z"; got != want {
		t.Fatalf("day start = %s, want %s", got, want)
	}
	if got, want := end.Format(time.RFC3339), "2026-07-27T07:00:00Z"; got != want {
		t.Fatalf("day end = %s, want %s", got, want)
	}
}

func TestValidateJournalCitationsRejectsInventedSegments(t *testing.T) {
	sources := []journalSummarySource{{
		Label: "entry",
		Text:  "A real transcript segment.",
		Citations: []journalCitation{{
			EntryID:   "entry-1",
			SegmentID: "s0",
		}},
	}}

	if err := validateJournalCitations(
		[]journalCitation{{EntryID: "entry-1", SegmentID: "s0"}},
		sources,
	); err != nil {
		t.Fatalf("valid citation rejected: %v", err)
	}
	if err := validateJournalCitations(
		[]journalCitation{{EntryID: "entry-1", SegmentID: "invented"}},
		sources,
	); err == nil {
		t.Fatal("invented citation was accepted")
	}
}

func TestHigherLevelSummarySourcesPreserveTranscriptCitations(t *testing.T) {
	citation := journalCitation{EntryID: "entry-1", SegmentID: "s2"}
	day := journalSummaryRecord{
		ID:        "day:2026-07-26",
		Period:    "day",
		Start:     time.Date(2026, time.July, 26, 0, 0, 0, 0, time.UTC),
		End:       time.Date(2026, time.July, 27, 0, 0, 0, 0, time.UTC),
		Body:      "A day about building.",
		Citations: []journalCitation{citation},
	}
	records := []journalRecord{{
		ID:      "subject",
		When:    "SUMMARY#day#2026-07-26T00:00:00Z",
		Kind:    "summary",
		Summary: &day,
	}}
	sources := summarySources(
		records,
		"week",
		time.Date(2026, time.July, 20, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.July, 27, 0, 0, 0, 0, time.UTC),
	)
	if len(sources) != 1 {
		t.Fatalf("got %d sources, want 1", len(sources))
	}
	if len(sources[0].Citations) != 1 || sources[0].Citations[0] != citation {
		t.Fatalf("citation was not preserved: %#v", sources[0].Citations)
	}
}

func TestCreateJournalEntryBuildsCitationHierarchy(t *testing.T) {
	db := &inMemoryDDB{}
	objects := &fakeJournalObjects{}
	server := &Server{
		ddb:               db,
		journalTableName:  "journal",
		journalBucketName: "journal-audio",
		journalObjects:    objects,
		journalAI:         fakeJournalAI{},
	}
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Issuer:  "https://api.zemn.me",
		Subject: "journal-user",
	})
	recordedAt := time.Date(2026, time.July, 26, 20, 0, 0, 0, time.UTC)
	response, err := server.PostJournalEntries(ctx, PostJournalEntriesRequestObject{
		Body: &JournalEntryCreate{
			AudioBase64:     "dm9pY2U=",
			ContentType:     JournalEntryCreateContentType("audio/webm"),
			DurationSeconds: 1.5,
			RecordedAt:      recordedAt,
			TimeZone:        "America/Los_Angeles",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	created, ok := response.(PostJournalEntries201JSONResponse)
	if !ok {
		t.Fatalf("unexpected create response: %#v", response)
	}
	if !objects.put {
		t.Fatal("audio was not stored")
	}
	if len(created.Summary.Citations) != 1 {
		t.Fatalf("entry summary citations = %#v", created.Summary.Citations)
	}

	journalResponse, err := server.GetJournal(ctx, GetJournalRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	journal, ok := journalResponse.(GetJournal200JSONResponse)
	if !ok {
		t.Fatalf("unexpected journal response: %#v", journalResponse)
	}
	if len(journal.Entries) != 1 {
		t.Fatalf("entries = %d, want 1", len(journal.Entries))
	}
	if len(journal.Summaries) != 4 {
		t.Fatalf("summaries = %d, want day/week/month/year", len(journal.Summaries))
	}
	for _, summary := range journal.Summaries {
		if len(summary.Citations) != 1 {
			t.Fatalf("%s citations were not preserved: %#v", summary.Period, summary.Citations)
		}
	}
}
