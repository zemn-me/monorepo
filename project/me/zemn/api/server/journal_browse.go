package apiserver

import (
	"fmt"
	"sort"
	"time"
)

// Calendar choices carry no transcripts or summary bodies. Only the selected
// period is expanded; changing the URL requests a new bounded content window.
func journalBrowse(records []JournalStoredRecord, view string, at *time.Time, now time.Time) (JournalBrowse, time.Time, time.Time) {
	focus := now
	location := time.UTC
	var newest time.Time
	for _, record := range records {
		if entry := record.Entry; entry != nil && entry.Status != JournalEntryStatusFailed && journalEntryIsVisible(*entry, now) && entry.RecordedAt.After(newest) {
			newest = entry.RecordedAt
			focus = newest
			if zone, err := time.LoadLocation(entry.TimeZone); err == nil {
				location = zone
			}
		}
	}
	if at != nil {
		focus = *at
	}
	start, end := periodBounds(focus, location, view)
	yearStart, yearEnd := periodBounds(focus, location, "year")
	monthStart, monthEnd := periodBounds(focus, location, "month")
	choices := map[string]JournalBrowsePeriod{}
	peers := map[time.Time]bool{}
	add := func(period string, when time.Time, title *string) {
		a, b := periodBounds(when, location, period)
		if period == view {
			peers[a] = true
		}
		if period == "month" && (a.Before(yearStart) || !a.Before(yearEnd)) {
			return
		}
		selectedWeekDay := view == "week" && period == "day" && a.Before(end) && b.After(start)
		if (period == "week" || period == "day") && (!a.Before(monthEnd) || !b.After(monthStart)) && !selectedWeekDay && !(period == view && !a.After(focus) && b.After(focus)) {
			return
		}
		id := fmt.Sprintf("%s:%s", period, a.UTC().Format(time.RFC3339))
		choice := choices[id]
		choice.Id, choice.Period, choice.Start, choice.End = id, JournalBrowsePeriodPeriod(period), a, b
		if title != nil {
			choice.Title = title
		}
		choices[id] = choice
	}
	for _, record := range records {
		if entry := record.Entry; entry != nil && entry.Status != JournalEntryStatusFailed && journalEntryIsVisible(*entry, now) {
			for _, period := range []string{"year", "month", "week", "day"} {
				var title *string
				if period == "day" {
					title = entry.Title
					if entry.Summary != nil {
						title = &entry.Summary.Title
					}
				}
				add(period, entry.RecordedAt, title)
			}
		}
		if summary := record.Summary; summary != nil && summary.Period != JournalSummaryPeriodEntry && summary.Period != JournalSummaryPeriodJournal {
			add(string(summary.Period), summary.Start.Add(summary.End.Sub(summary.Start)/2), &summary.Title)
		}
	}
	if view != "overview" {
		add(view, focus, nil)
	}
	result := JournalBrowse{Focus: focus, TimeZone: location.String(), Periods: []JournalBrowsePeriod{}, Locations: []JournalEntry{}}
	if view == "year" || view == "month" || view == "week" {
		for _, record := range records {
			entry := record.Entry
			if entry == nil || entry.Status != JournalEntryStatusReady || entry.Location == nil || entry.RecordedAt.Before(start) || !entry.RecordedAt.Before(end) {
				continue
			}
			point := journalEntryContent(*entry)
			point.Transcript = []JournalTranscriptSegment{}
			if point.Title == nil && point.Summary != nil {
				point.Title = &point.Summary.Title
			}
			point.Summary = nil
			result.Locations = append(result.Locations, point)
		}
	}
	for _, choice := range choices {
		result.Periods = append(result.Periods, choice)
	}
	sort.Slice(result.Periods, func(i, j int) bool { return result.Periods[i].Start.After(result.Periods[j].Start) })
	for peer := range peers {
		if peer.Before(start) && (result.Previous == nil || peer.After(*result.Previous)) {
			value := peer
			result.Previous = &value
		}
		if peer.After(start) && (result.Next == nil || peer.Before(*result.Next)) {
			value := peer
			result.Next = &value
		}
	}
	return result, start, end
}

// Citation previews need only their cited segments. Unselected recordings do not
// acquire signed audio URLs or send their complete transcripts to the browser.
func journalBrowseSources(records []JournalStoredRecord, entries []JournalEntry, summaries []JournalSummary) []JournalEntry {
	loaded := map[string]bool{}
	for _, entry := range entries {
		loaded[entry.Id.String()] = len(entry.Transcript) > 0
		if entry.Summary != nil {
			summaries = append(summaries, *entry.Summary)
		}
	}
	needed := map[string]map[string]bool{}
	for _, summary := range summaries {
		for _, block := range summary.Blocks {
			for _, citation := range block.Citations {
				if loaded[citation.EntryId] {
					continue
				}
				if needed[citation.EntryId] == nil {
					needed[citation.EntryId] = map[string]bool{}
				}
				needed[citation.EntryId][citation.SegmentId] = true
			}
		}
	}
	result := []JournalEntry{}
	for _, record := range records {
		if record.Entry == nil {
			continue
		}
		segments := needed[record.Entry.Id]
		if len(segments) == 0 {
			continue
		}
		entry := journalEntryContent(*record.Entry)
		entry.Summary = nil
		entry.Transcript = []JournalTranscriptSegment{}
		for _, segment := range record.Entry.Transcript {
			if segments[segment.Id] {
				entry.Transcript = append(entry.Transcript, segment)
			}
		}
		result = append(result, entry)
	}
	return result
}
