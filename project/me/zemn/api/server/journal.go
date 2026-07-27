package apiserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const maxJournalAudioBytes = 6 * 1024 * 1024

type journalEntryRecord struct {
	ID              string                     `dynamodbav:"id"`
	RecordedAt      time.Time                  `dynamodbav:"recorded_at"`
	DurationSeconds float64                    `dynamodbav:"duration_seconds"`
	AudioKey        string                     `dynamodbav:"audio_key"`
	Transcript      []journalTranscriptSegment `dynamodbav:"transcript"`
	Summary         journalSummaryRecord       `dynamodbav:"summary"`
}

type journalSummaryRecord struct {
	ID        string            `dynamodbav:"id"`
	Period    string            `dynamodbav:"period"`
	Start     time.Time         `dynamodbav:"start"`
	End       time.Time         `dynamodbav:"end"`
	Title     string            `dynamodbav:"title"`
	Body      string            `dynamodbav:"body"`
	Themes    []string          `dynamodbav:"themes"`
	Citations []journalCitation `dynamodbav:"citations"`
}

type journalRecord struct {
	ID      string                `dynamodbav:"id"`
	When    string                `dynamodbav:"when"`
	Kind    string                `dynamodbav:"kind"`
	Entry   *journalEntryRecord   `dynamodbav:"entry,omitempty"`
	Summary *journalSummaryRecord `dynamodbav:"summary,omitempty"`
}

func journalSubject(ctx context.Context) (string, error) {
	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return "", errors.New("authenticated subject is unavailable")
	}
	return info.Issuer + "\x00" + info.Subject, nil
}

func (s *Server) listJournalRecords(ctx context.Context, subject string) ([]journalRecord, error) {
	out, err := s.ddb.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(s.journalTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: subject},
		},
	})
	if err != nil {
		return nil, err
	}
	var records []journalRecord
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &records); err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Server) putJournalRecord(ctx context.Context, record journalRecord) error {
	item, err := attributevalue.MarshalMap(record)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.journalTableName),
		Item:      item,
	})
	return err
}

func apiJournalCitation(citation journalCitation) JournalCitation {
	return JournalCitation{
		EntryId:   citation.EntryID,
		SegmentId: citation.SegmentID,
	}
}

func apiJournalSummary(summary journalSummaryRecord) JournalSummary {
	citations := make([]JournalCitation, 0, len(summary.Citations))
	for _, citation := range summary.Citations {
		citations = append(citations, apiJournalCitation(citation))
	}
	return JournalSummary{
		Id:        summary.ID,
		Period:    JournalSummaryPeriod(summary.Period),
		Start:     summary.Start,
		End:       summary.End,
		Title:     summary.Title,
		Body:      summary.Body,
		Themes:    summary.Themes,
		Citations: citations,
	}
}

func apiJournalEntry(entry journalEntryRecord) JournalEntry {
	transcript := make([]JournalTranscriptSegment, 0, len(entry.Transcript))
	for _, segment := range entry.Transcript {
		transcript = append(transcript, JournalTranscriptSegment{
			Id:           segment.ID,
			StartSeconds: segment.StartSeconds,
			EndSeconds:   segment.EndSeconds,
			Text:         segment.Text,
		})
	}
	return JournalEntry{
		Id:              entry.ID,
		RecordedAt:      entry.RecordedAt,
		DurationSeconds: entry.DurationSeconds,
		Transcript:      transcript,
		Summary:         apiJournalSummary(entry.Summary),
	}
}

func (s *Server) GetJournal(ctx context.Context, _ GetJournalRequestObject) (GetJournalResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	records, err := s.listJournalRecords(ctx, subject)
	if err != nil {
		return nil, err
	}
	entries := make([]JournalEntry, 0)
	summaries := make([]JournalSummary, 0)
	for _, record := range records {
		if record.Entry != nil {
			entries = append(entries, apiJournalEntry(*record.Entry))
		}
		if record.Summary != nil {
			summaries = append(summaries, apiJournalSummary(*record.Summary))
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].RecordedAt.After(entries[j].RecordedAt)
	})
	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].Start.Equal(summaries[j].Start) {
			return summaries[i].Period < summaries[j].Period
		}
		return summaries[i].Start.After(summaries[j].Start)
	})
	return GetJournal200JSONResponse{
		Entries:   entries,
		Summaries: summaries,
	}, nil
}

func transcriptSources(entryID string, segments []journalTranscriptSegment) []journalSummarySource {
	sources := make([]journalSummarySource, 0, len(segments))
	for _, segment := range segments {
		citation := journalCitation{EntryID: entryID, SegmentID: segment.ID}
		sources = append(sources, journalSummarySource{
			Label:     fmt.Sprintf("%s#%s", entryID, segment.ID),
			Text:      segment.Text,
			Citations: []journalCitation{citation},
		})
	}
	return sources
}

func summaryRecord(id, period string, start, end time.Time, result journalSummaryResult) journalSummaryRecord {
	return journalSummaryRecord{
		ID:        id,
		Period:    period,
		Start:     start,
		End:       end,
		Title:     result.Title,
		Body:      result.Body,
		Themes:    result.Themes,
		Citations: result.Citations,
	}
}

func periodBounds(at time.Time, location *time.Location, period string) (time.Time, time.Time) {
	local := at.In(location)
	var start time.Time
	switch period {
	case "day":
		start = time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	case "week":
		offset := (int(local.Weekday()) + 6) % 7
		day := local.AddDate(0, 0, -offset)
		start = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, location)
	case "month":
		start = time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, location)
	case "year":
		start = time.Date(local.Year(), time.January, 1, 0, 0, 0, 0, location)
	}
	var end time.Time
	switch period {
	case "day":
		end = start.AddDate(0, 0, 1)
	case "week":
		end = start.AddDate(0, 0, 7)
	case "month":
		end = start.AddDate(0, 1, 0)
	case "year":
		end = start.AddDate(1, 0, 0)
	}
	return start.UTC(), end.UTC()
}

func summarySources(records []journalRecord, period string, start, end time.Time) []journalSummarySource {
	var sources []journalSummarySource
	for _, record := range records {
		if period == "day" && record.Entry != nil {
			entry := record.Entry
			if !entry.RecordedAt.Before(start) && entry.RecordedAt.Before(end) {
				summary := entry.Summary
				sources = append(sources, journalSummarySource{
					Label:     summary.ID,
					Text:      summary.Body,
					Citations: summary.Citations,
				})
			}
			continue
		}
		if record.Summary == nil {
			continue
		}
		childPeriod := map[string]string{
			"week":  "day",
			"month": "day",
			"year":  "month",
		}[period]
		summary := record.Summary
		if summary.Period == childPeriod && !summary.Start.Before(start) && summary.Start.Before(end) {
			sources = append(sources, journalSummarySource{
				Label:     summary.ID,
				Text:      summary.Body,
				Citations: summary.Citations,
			})
		}
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].Label < sources[j].Label })
	return sources
}

func replaceJournalSummary(records []journalRecord, subject string, summary journalSummaryRecord) []journalRecord {
	key := "SUMMARY#" + summary.Period + "#" + summary.Start.Format(time.RFC3339)
	for i := range records {
		if records[i].When == key {
			records[i].Summary = &summary
			return records
		}
	}
	return append(records, journalRecord{ID: subject, When: key, Kind: "summary", Summary: &summary})
}

func (s *Server) refreshJournalSummary(ctx context.Context, subject, period string, at time.Time, location *time.Location, records []journalRecord) ([]journalRecord, error) {
	start, end := periodBounds(at, location, period)
	sources := summarySources(records, period, start, end)
	if len(sources) == 0 {
		return records, nil
	}
	result, err := s.journalAI.Summarize(ctx, period, sources)
	if err != nil {
		return records, err
	}
	id := period + ":" + start.Format(time.RFC3339)
	summary := summaryRecord(id, period, start, end, result)
	record := journalRecord{
		ID:      subject,
		When:    "SUMMARY#" + period + "#" + start.Format(time.RFC3339),
		Kind:    "summary",
		Summary: &summary,
	}
	if err := s.putJournalRecord(ctx, record); err != nil {
		return records, err
	}
	return replaceJournalSummary(records, subject, summary), nil
}

func (s *Server) PostJournalEntries(ctx context.Context, request PostJournalEntriesRequestObject) (PostJournalEntriesResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	if request.Body == nil {
		return PostJournalEntries400JSONResponse{Cause: "request body is required"}, nil
	}
	audio, err := base64.StdEncoding.DecodeString(request.Body.AudioBase64)
	if err != nil || len(audio) == 0 {
		return PostJournalEntries400JSONResponse{Cause: "audioBase64 must contain valid audio"}, nil
	}
	if len(audio) > maxJournalAudioBytes {
		return PostJournalEntries400JSONResponse{Cause: "voice notes must be 6 MiB or smaller"}, nil
	}
	location, err := time.LoadLocation(request.Body.TimeZone)
	if err != nil {
		return PostJournalEntries400JSONResponse{Cause: "timeZone must be a valid IANA time zone"}, nil
	}
	entryID := uuid.NewString()
	audioKey := strings.ReplaceAll(subject, "\x00", "/") + "/" + entryID
	if s.journalObjects == nil || s.journalBucketName == "" {
		return nil, errors.New("journal object storage is not configured")
	}
	if _, err := s.journalObjects.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.journalBucketName),
		Key:         aws.String(audioKey),
		Body:        bytes.NewReader(audio),
		ContentType: aws.String(string(request.Body.ContentType)),
	}); err != nil {
		return nil, err
	}
	segments, err := s.journalAI.Transcribe(ctx, audio, string(request.Body.ContentType))
	if err != nil {
		return PostJournalEntries502JSONResponse{Cause: err.Error()}, nil
	}
	entryResult, err := s.journalAI.Summarize(ctx, "entry", transcriptSources(entryID, segments))
	if err != nil {
		return PostJournalEntries502JSONResponse{Cause: err.Error()}, nil
	}
	recordedAt := request.Body.RecordedAt
	entrySummary := summaryRecord(
		"entry:"+entryID,
		"entry",
		recordedAt,
		recordedAt.Add(time.Duration(request.Body.DurationSeconds*float64(time.Second))),
		entryResult,
	)
	entry := journalEntryRecord{
		ID:              entryID,
		RecordedAt:      recordedAt,
		DurationSeconds: request.Body.DurationSeconds,
		AudioKey:        audioKey,
		Transcript:      segments,
		Summary:         entrySummary,
	}
	entryRecord := journalRecord{
		ID:    subject,
		When:  "ENTRY#" + recordedAt.Format(time.RFC3339Nano) + "#" + entryID,
		Kind:  "entry",
		Entry: &entry,
	}
	if err := s.putJournalRecord(ctx, entryRecord); err != nil {
		return nil, err
	}
	records, err := s.listJournalRecords(ctx, subject)
	if err != nil {
		return nil, err
	}
	for _, period := range []string{"day", "week", "month", "year"} {
		records, err = s.refreshJournalSummary(ctx, subject, period, recordedAt, location, records)
		if err != nil {
			return PostJournalEntries502JSONResponse{Cause: err.Error()}, nil
		}
	}
	return PostJournalEntries201JSONResponse(apiJournalEntry(entry)), nil
}
