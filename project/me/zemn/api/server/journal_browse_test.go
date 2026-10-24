package apiserver

import (
	"testing"
	"time"
)

func TestJournalCalendarLoadsOnlySelectedDay(t *testing.T) {
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	view := GetJournalParamsView("day")
	at := entries[0].RecordedAt
	response, err := s.GetJournal(ctx, GetJournalRequestObject{Params: GetJournalParams{View: &view, At: &at}})
	if err != nil {
		t.Fatal(err)
	}
	journal := response.(GetJournal200JSONResponse)
	if len(journal.Entries) != 1 || journal.Entries[0].Id.String() != entries[0].Id || len(journal.Entries[0].Transcript) == 0 {
		t.Fatalf("selected day should load its own transcript: %#v", journal.Entries)
	}
	if journal.Browse == nil || journal.Browse.Next == nil || journal.Browse.Previous != nil {
		t.Fatalf("missing next-day navigation: %#v", journal.Browse)
	}
	view = GetJournalParamsView("month")
	response, err = s.GetJournal(ctx, GetJournalRequestObject{Params: GetJournalParams{View: &view, At: &at}})
	if err != nil {
		t.Fatal(err)
	}
	month := response.(GetJournal200JSONResponse)
	if len(month.Entries) != 0 {
		t.Fatal("month browsing loaded recordings")
	}
	days := 0
	for _, period := range month.Browse.Periods {
		if period.Period == "day" {
			days++
		}
	}
	if days != 2 {
		t.Fatalf("month day choices = %d", days)
	}
	view = GetJournalParamsView("overview")
	response, err = s.GetJournal(ctx, GetJournalRequestObject{Params: GetJournalParams{View: &view}})
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range response.(GetJournal200JSONResponse).Entries {
		if len(entry.Transcript) != 0 || entry.AudioUrl != nil {
			t.Fatal("overview loaded recording payloads")
		}
	}
	// Empty dates remain addressable rather than silently showing a different day.
	empty := now.AddDate(0, 0, 4)
	view = GetJournalParamsView("day")
	response, err = s.GetJournal(ctx, GetJournalRequestObject{Params: GetJournalParams{View: &view, At: &empty}})
	if err != nil {
		t.Fatal(err)
	}
	if len(response.(GetJournal200JSONResponse).Entries) != 0 {
		t.Fatal("empty day loaded a neighboring recording")
	}
}

func TestJournalCalendarWeekIncludesBothMonths(t *testing.T) {
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	for i := range entries {
		entries[i].RecordedAt = time.Date(2026, 8, 31+i, 12, 0, 0, 0, time.UTC)
		if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[i]); err != nil {
			t.Fatal(err)
		}
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	browse, _, _ := journalBrowse(records, "week", &entries[0].RecordedAt, now)
	days := 0
	for _, choice := range browse.Periods {
		if choice.Period == "day" {
			days++
		}
	}
	if days != 2 {
		t.Fatalf("cross-month week lost day choices: %#v", browse.Periods)
	}
}

func TestJournalCalendarDayBoundsRespectDST(t *testing.T) {
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	at := time.Date(2026, 11, 1, 20, 0, 0, 0, time.UTC)
	entries[0].RecordedAt, entries[0].TimeZone = at, "America/Los_Angeles"
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[0]); err != nil {
		t.Fatal(err)
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	browse, start, end := journalBrowse(records, "day", &at, now)
	if end.Sub(start) != 25*time.Hour || browse.TimeZone != "America/Los_Angeles" {
		t.Fatalf("DST day bounds: %s to %s, %s", start, end, browse.TimeZone)
	}
}

func TestJournalBrowseCitationSourcesExcludeUncitedTranscript(t *testing.T) {
	s, _, ctx, entries, _ := journalKnowledgeFixture(t)
	entries[1].Transcript = append(entries[1].Transcript, JournalTranscriptSegment{Id: "uncited", Text: "Unrelated private material"})
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, entries[1]); err != nil {
		t.Fatal(err)
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	sources := journalBrowseSources(records, nil, []JournalSummary{{Blocks: []JournalSummaryBlock{{Citations: []JournalCitation{{EntryId: entries[1].Id, SegmentId: "s0"}}}}}})
	if len(sources) != 1 || len(sources[0].Transcript) != 1 || sources[0].Transcript[0].Id != "s0" || sources[0].AudioUrl != nil {
		t.Fatalf("citation previews loaded unrelated evidence or audio: %#v", sources)
	}
}

func TestJournalCalendarMonthNavigationCrossesYearBoundary(t *testing.T) {
	s, _, ctx, entries, now := journalKnowledgeFixture(t)
	entries[0].RecordedAt = time.Date(2025, 12, 15, 12, 0, 0, 0, time.UTC)
	entries[1].RecordedAt = time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
	entries[1].Location = &JournalLocation{Latitude: 40.7, Longitude: -74, AccuracyMeters: 25}
	for _, entry := range entries {
		if err := s.updateJournalEntry(ctx, journalOwnerSubject, entry); err != nil {
			t.Fatal(err)
		}
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	browse, _, _ := journalBrowse(records, "month", &entries[1].RecordedAt, now)
	if browse.Previous == nil || browse.Previous.Year() != 2025 || browse.Previous.Month() != time.December || browse.Next != nil {
		t.Fatalf("month navigation lost the previous year: %#v", browse)
	}
	for _, choice := range browse.Periods {
		if choice.Period == "month" && choice.Start.Year() != 2026 {
			t.Fatal("month choices escaped selected year")
		}
	}
	if len(browse.Locations) != 1 || len(browse.Locations[0].Transcript) != 0 || browse.Locations[0].AudioUrl != nil {
		t.Fatalf("map loaded recording payloads: %#v", browse.Locations)
	}
}

func TestJournalCalendarSummaryKeepsItsDateAcrossTimeZones(t *testing.T) {
	s, _, ctx, entries, _ := journalKnowledgeFixture(t)
	for i, title := range []string{"Selected day", "Neighboring day"} {
		start := time.Date(2026, 9, 27-i, 7, 0, 0, 0, time.UTC)
		summary := summaryRecord(title, JournalSummaryPeriodDay, start, start.Add(24*time.Hour), JournalSummaryResult{
			Title: title, Blocks: []JournalSummaryBlock{{Markdown: "A cited note.[^1]", Citations: []JournalCitation{{EntryId: entries[0].Id, SegmentId: "s0", Quote: entries[0].Transcript[0].Text}}}},
		}, "fixture")
		if err := s.putJournalRecord(ctx, JournalStoredRecord{Id: journalOwnerSubject, When: journalSummaryRecordKey(JournalSummaryPeriodDay, start), Kind: JournalStoredRecordKindSummary, Summary: &summary}); err != nil {
			t.Fatal(err)
		}
	}
	view := GetJournalParamsView("day")
	response, err := s.GetJournal(ctx, GetJournalRequestObject{Params: GetJournalParams{View: &view, At: &entries[0].RecordedAt}})
	if err != nil {
		t.Fatal(err)
	}
	summaries := response.(GetJournal200JSONResponse).Summaries
	if len(summaries) != 1 || summaries[0].Title != "Selected day" {
		t.Fatalf("summary selection included a neighboring date: %#v", summaries)
	}
}
