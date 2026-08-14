package apiserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const (
	journalOwnerSubject      = "thomas"
	journalLocalOwnerSubject = "integration-test-local"
	maxJournalAudioBytes     = 25 * 1024 * 1024
	journalURLLifetime       = 5 * time.Minute
)

var journalCitationReferencePattern = regexp.MustCompile(`\[\^([0-9]+)\]`)

func journalCitationReferenceIndexes(markdown string) ([]int, error) {
	matches := journalCitationReferencePattern.FindAllStringSubmatch(markdown, -1)
	indexes := make([]int, 0, len(matches))
	for _, match := range matches {
		index, err := strconv.Atoi(match[1])
		if err != nil {
			return nil, fmt.Errorf("parse journal citation reference %q: %w", match[0], err)
		}
		indexes = append(indexes, index)
	}
	return indexes, nil
}

type JournalObjectStore interface {
	DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

type JournalPresigner interface {
	PresignGetObject(context.Context, *s3.GetObjectInput, ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
	PresignPutObject(context.Context, *s3.PutObjectInput, ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
}

func journalSubject(ctx context.Context) (string, error) {
	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return "", errors.New("authenticated subject is unavailable")
	}
	if info.Subject == journalLocalOwnerSubject {
		return journalOwnerSubject, nil
	}
	if info.Subject != journalOwnerSubject {
		return "", errors.New("the journal is restricted to its owner")
	}
	return info.Subject, nil
}

func journalEntryKey(entryID string) string { return "entries/" + entryID + "/source" }

func journalEntryRecordKey(entryID string) string { return "ENTRY#" + entryID }

func journalContentHashRecordKey(contentSHA256 string) string {
	return "CONTENT_SHA256#" + contentSHA256
}

func journalEntryIDFromKey(key string) (string, bool) {
	parts := strings.Split(key, "/")
	if len(parts) != 3 || parts[0] != "entries" || parts[2] != "source" {
		return "", false
	}
	if _, err := uuid.Parse(parts[1]); err != nil {
		return "", false
	}
	return parts[1], true
}

func (s *Server) listJournalRecords(ctx context.Context, subject string) ([]JournalStoredRecord, error) {
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
	var records []JournalStoredRecord
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &records); err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Server) putJournalRecord(ctx context.Context, record JournalStoredRecord) error {
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

func (s *Server) putJournalJSON(ctx context.Context, key string, value any) error {
	if s.journalObjects == nil || s.journalBucketName == "" {
		return errors.New("journal object storage is not configured")
	}
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = s.journalObjects.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.journalBucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(append(body, '\n')),
		ContentType: aws.String("application/json"),
	})
	return err
}

func journalEntryMetadata(entry JournalStoredEntry) JournalEntryMetadata {
	metadata := JournalEntryMetadata{
		SchemaVersion: 1,
		Id:            entry.Id,
		RecordedAt:    entry.RecordedAt,
		TimeZone:      entry.TimeZone,
		DurationMs:    entry.DurationMs,
		ContentType:   entry.ContentType,
		ByteLength:    entry.ByteLength,
		ContentSha256: entry.ContentSha256,
		AudioKey:      entry.AudioKey,
		Status:        entry.Status,
	}
	if entry.Error != "" {
		metadata.Error = &entry.Error
	}
	return metadata
}

func (s *Server) writeJournalEntryFiles(ctx context.Context, entry JournalStoredEntry) error {
	prefix := "entries/" + entry.Id + "/"
	if err := s.putJournalJSON(ctx, prefix+"metadata.json", journalEntryMetadata(entry)); err != nil {
		return err
	}
	if len(entry.Transcript) > 0 {
		if err := s.putJournalJSON(ctx, prefix+"transcript.json", JournalTranscriptFile{
			SchemaVersion: 1,
			EntryId:       entry.Id,
			Segments:      entry.Transcript,
		}); err != nil {
			return err
		}
	}
	if entry.Summary != nil {
		if err := s.putJournalJSON(ctx, prefix+"summary.json", entry.Summary); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) journalAudioURL(ctx context.Context, entry JournalStoredEntry) *string {
	if s.journalPresigner == nil || entry.AudioKey == "" || entry.Status == JournalEntryStatusAwaitingUpload {
		return nil
	}
	request, err := s.journalPresigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.journalBucketName),
		Key:    aws.String(entry.AudioKey),
	}, func(options *s3.PresignOptions) { options.Expires = journalURLLifetime })
	if err != nil {
		return nil
	}
	return &request.URL
}

func (s *Server) apiJournalEntry(ctx context.Context, entry JournalStoredEntry) JournalEntry {
	result := JournalEntry{
		SchemaVersion: 1,
		Id:            openapiUUID(entry.Id),
		RecordedAt:    entry.RecordedAt,
		TimeZone:      entry.TimeZone,
		DurationMs:    entry.DurationMs,
		ContentType:   entry.ContentType,
		ByteLength:    entry.ByteLength,
		Status:        JournalEntryStatus(entry.Status),
		AudioUrl:      s.journalAudioURL(ctx, entry),
		Transcript:    entry.Transcript,
	}
	if entry.Error != "" {
		result.Error = &entry.Error
	}
	if entry.Summary != nil {
		result.Summary = entry.Summary
	}
	return result
}

func openapiUUID(value string) uuid.UUID {
	parsed, _ := uuid.Parse(value)
	return parsed
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
	now := time.Now().UTC()
	for _, record := range records {
		if record.Entry != nil && journalEntryIsVisible(*record.Entry, now) {
			entries = append(entries, s.apiJournalEntry(ctx, *record.Entry))
		}
		if record.Summary != nil {
			summaries = append(summaries, *record.Summary)
		}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].RecordedAt.After(entries[j].RecordedAt) })
	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].Start.Equal(summaries[j].Start) {
			return summaries[i].Period < summaries[j].Period
		}
		return summaries[i].Start.After(summaries[j].Start)
	})
	return GetJournal200JSONResponse{Entries: entries, Summaries: summaries}, nil
}

func journalEntryIsVisible(entry JournalStoredEntry, now time.Time) bool {
	switch entry.Status {
	case JournalEntryStatusReady, JournalEntryStatusProcessing:
		return true
	case JournalEntryStatusAwaitingUpload:
		return entry.UploadExpiresAt != nil && now.Before(*entry.UploadExpiresAt)
	default:
		return false
	}
}

func transcriptSources(entryID string, segments []JournalTranscriptSegment) []JournalSummarySource {
	sources := make([]JournalSummarySource, 0, len(segments))
	for _, segment := range segments {
		citation := JournalCitation{EntryId: entryID, SegmentId: segment.Id, Quote: segment.Text}
		sources = append(sources, JournalSummarySource{
			Label: fmt.Sprintf("%s#%s", entryID, segment.Id), Text: segment.Text, Citations: []JournalCitation{citation},
		})
	}
	return sources
}

func summarySourceFingerprint(sources []JournalSummarySource) (string, error) {
	encoded, err := json.Marshal(sources)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", sha256.Sum256(encoded)), nil
}

func summaryRecord(id string, period JournalSummaryPeriod, start, end time.Time, result JournalSummaryResult, sourceFingerprint string) JournalSummary {
	return JournalSummary{
		SchemaVersion: 1, Id: id, Period: period, Start: start, End: end,
		Title: result.Title, Blocks: result.Blocks, SourceFingerprint: sourceFingerprint,
	}
}

func periodBounds(at time.Time, location *time.Location, period string) (time.Time, time.Time) {
	local := at.In(location)
	var start time.Time
	switch period {
	case "day":
		start = time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	case "week":
		day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
		daysSinceMonday := (int(day.Weekday()) + 6) % 7
		start = day.AddDate(0, 0, -daysSinceMonday)
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

func summaryText(summary JournalSummary) string {
	parts := make([]string, 0, len(summary.Blocks))
	for _, block := range summary.Blocks {
		parts = append(parts, strings.TrimSpace(journalCitationReferencePattern.ReplaceAllString(block.Markdown, "")))
	}
	return strings.Join(parts, "\n\n")
}

func summaryCitations(summary JournalSummary) []JournalCitation {
	var citations []JournalCitation
	for _, block := range summary.Blocks {
		citations = append(citations, block.Citations...)
	}
	return citations
}

func journalSummarySource(summary JournalSummary) JournalSummarySource {
	return JournalSummarySource{
		Label: summary.Id, Text: summaryText(summary), Citations: summaryCitations(summary),
	}
}

func readyEntrySummarySources(records []JournalStoredRecord, start, end time.Time) []JournalSummarySource {
	var sources []JournalSummarySource
	for _, record := range records {
		if record.Entry == nil {
			continue
		}
		entry := record.Entry
		if entry.Status != JournalEntryStatusReady || entry.Summary == nil || entry.RecordedAt.Before(start) || !entry.RecordedAt.Before(end) {
			continue
		}
		sources = append(sources, journalSummarySource(*entry.Summary))
	}
	return sources
}

func childJournalSummaries(records []JournalStoredRecord, period JournalSummaryPeriod, start, end time.Time) []JournalSummary {
	var summaries []JournalSummary
	for _, record := range records {
		if record.Summary != nil && record.Summary.Period == period && !record.Summary.Start.Before(start) && record.Summary.Start.Before(end) {
			summaries = append(summaries, *record.Summary)
		}
	}
	return summaries
}

func journalSummaryCovers(summary JournalSummary, timestamp time.Time) bool {
	return !timestamp.Before(summary.Start) && timestamp.Before(summary.End)
}

func dayJournalSummarySources(records []JournalStoredRecord, start, end time.Time) []JournalSummarySource {
	daySummaries := childJournalSummaries(records, JournalSummaryPeriodDay, start, end)
	sources := make([]JournalSummarySource, 0, len(daySummaries))
	for _, summary := range daySummaries {
		sources = append(sources, journalSummarySource(summary))
	}
	for _, record := range records {
		if record.Entry == nil {
			continue
		}
		entry := record.Entry
		if entry.Status != JournalEntryStatusReady || entry.Summary == nil || entry.RecordedAt.Before(start) || !entry.RecordedAt.Before(end) {
			continue
		}
		covered := false
		for _, summary := range daySummaries {
			if journalSummaryCovers(summary, entry.RecordedAt) {
				covered = true
				break
			}
		}
		if !covered {
			sources = append(sources, journalSummarySource(*entry.Summary))
		}
	}
	return sources
}

func monthJournalSummarySources(records []JournalStoredRecord, start, end time.Time) ([]JournalSummarySource, error) {
	monthSummaries := childJournalSummaries(records, JournalSummaryPeriodMonth, start, end)
	sources := make([]JournalSummarySource, 0, len(monthSummaries))
	for _, summary := range monthSummaries {
		sources = append(sources, journalSummarySource(summary))
	}
	type monthBounds struct{ start, end time.Time }
	missingMonths := map[string]monthBounds{}
	for _, record := range records {
		if record.Entry == nil {
			continue
		}
		entry := record.Entry
		if entry.Status != JournalEntryStatusReady || entry.Summary == nil || entry.RecordedAt.Before(start) || !entry.RecordedAt.Before(end) {
			continue
		}
		covered := false
		for _, summary := range monthSummaries {
			if journalSummaryCovers(summary, entry.RecordedAt) {
				covered = true
				break
			}
		}
		if covered {
			continue
		}
		location, err := time.LoadLocation(entry.TimeZone)
		if err != nil {
			return nil, err
		}
		monthStart, monthEnd := periodBounds(entry.RecordedAt, location, string(JournalSummaryPeriodMonth))
		missingMonths[monthStart.Format(time.RFC3339)] = monthBounds{start: monthStart, end: monthEnd}
	}
	keys := make([]string, 0, len(missingMonths))
	for key := range missingMonths {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		bounds := missingMonths[key]
		monthSources := dayJournalSummarySources(records, bounds.start, bounds.end)
		switch len(monthSources) {
		case 1:
			sources = append(sources, monthSources[0])
		case 0:
			continue
		default:
			return nil, fmt.Errorf("month %s has %d sources but no month summary", key, len(monthSources))
		}
	}
	return sources, nil
}

func summarySources(records []JournalStoredRecord, period JournalSummaryPeriod, start, end time.Time) ([]JournalSummarySource, error) {
	var sources []JournalSummarySource
	switch period {
	case JournalSummaryPeriodDay:
		sources = readyEntrySummarySources(records, start, end)
	case JournalSummaryPeriodWeek, JournalSummaryPeriodMonth:
		sources = dayJournalSummarySources(records, start, end)
	case JournalSummaryPeriodYear:
		var err error
		sources, err = monthJournalSummarySources(records, start, end)
		if err != nil {
			return nil, err
		}
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].Label < sources[j].Label })
	return sources, nil
}

func replaceJournalSummary(records []JournalStoredRecord, subject string, summary JournalSummary) []JournalStoredRecord {
	key := "SUMMARY#" + string(summary.Period) + "#" + summary.Start.Format(time.RFC3339)
	for i := range records {
		if records[i].When == key {
			records[i].Summary = &summary
			return records
		}
	}
	return append(records, JournalStoredRecord{Id: subject, When: key, Kind: JournalStoredRecordKindSummary, Summary: &summary})
}

func removeJournalSummary(records []JournalStoredRecord, key string) []JournalStoredRecord {
	result := records[:0]
	for _, record := range records {
		if record.When != key {
			result = append(result, record)
		}
	}
	return result
}

func journalAggregateObjectKey(period JournalSummaryPeriod, start time.Time) string {
	return fmt.Sprintf("aggregates/%s/%s.json", period, start.Format("2006-01-02"))
}

func (s *Server) deleteJournalSummary(ctx context.Context, subject, key string, period JournalSummaryPeriod, start time.Time, records []JournalStoredRecord) ([]JournalStoredRecord, error) {
	found := false
	for _, record := range records {
		if record.When == key && record.Summary != nil {
			found = true
			break
		}
	}
	if !found {
		return records, nil
	}
	if _, err := s.journalObjects.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.journalBucketName),
		Key:    aws.String(journalAggregateObjectKey(period, start)),
	}); err != nil {
		return records, err
	}
	if _, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.journalTableName),
		Key: map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: subject},
			"when": &types.AttributeValueMemberS{Value: key},
		},
	}); err != nil {
		return records, err
	}
	return removeJournalSummary(records, key), nil
}

func (s *Server) refreshJournalSummary(ctx context.Context, subject string, period JournalSummaryPeriod, at time.Time, location *time.Location, records []JournalStoredRecord) ([]JournalStoredRecord, error) {
	start, end := periodBounds(at, location, string(period))
	sources, err := summarySources(records, period, start, end)
	if err != nil {
		return records, err
	}
	key := "SUMMARY#" + string(period) + "#" + start.Format(time.RFC3339)
	if len(sources) < 2 {
		return s.deleteJournalSummary(ctx, subject, key, period, start, records)
	}
	sourceFingerprint, err := summarySourceFingerprint(sources)
	if err != nil {
		return records, err
	}
	for _, record := range records {
		if record.When == key && record.Summary != nil && record.Summary.SourceFingerprint == sourceFingerprint {
			return records, nil
		}
	}
	result, err := s.journalAI.Summarize(ctx, string(period), sources)
	if err != nil {
		return records, err
	}
	summary := summaryRecord(string(period)+":"+start.Format(time.RFC3339), period, start, end, result, sourceFingerprint)
	record := JournalStoredRecord{
		Id: subject, When: key, Kind: JournalStoredRecordKindSummary, Summary: &summary,
	}
	if err := s.putJournalRecord(ctx, record); err != nil {
		return records, err
	}
	objectKey := journalAggregateObjectKey(period, start)
	if err := s.putJournalJSON(ctx, objectKey, summary); err != nil {
		return records, err
	}
	return replaceJournalSummary(records, subject, summary), nil
}

func requestHeaders(headers http.Header) map[string]string {
	result := make(map[string]string, len(headers))
	for name, values := range headers {
		if strings.EqualFold(name, "host") {
			continue
		}
		if len(values) > 0 {
			result[name] = values[0]
		}
	}
	return result
}

func (s *Server) PostJournalEntries(ctx context.Context, request PostJournalEntriesRequestObject) (PostJournalEntriesResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	if request.Body == nil {
		return PostJournalEntries400JSONResponse{Cause: "request body is required"}, nil
	}
	if _, err := time.LoadLocation(request.Body.TimeZone); err != nil {
		return PostJournalEntries400JSONResponse{Cause: "timeZone must be a valid IANA time zone"}, nil
	}
	if s.journalPresigner == nil || s.journalObjects == nil || s.journalBucketName == "" {
		return nil, errors.New("journal object storage is not configured")
	}
	entryID := uuid.NewString()
	contentType := string(request.Body.ContentType)
	expiresAt := time.Now().UTC().Add(journalURLLifetime)
	entry := JournalStoredEntry{
		SchemaVersion:   1,
		Id:              entryID,
		RecordedAt:      request.Body.RecordedAt,
		TimeZone:        request.Body.TimeZone,
		ContentType:     contentType,
		AudioKey:        journalEntryKey(entryID),
		UploadExpiresAt: &expiresAt,
		Status:          JournalEntryStatusAwaitingUpload,
		Transcript:      []JournalTranscriptSegment{},
	}
	if err := s.putJournalRecord(ctx, JournalStoredRecord{
		Id: subject, When: journalEntryRecordKey(entryID), Kind: JournalStoredRecordKindEntry, Entry: &entry,
	}); err != nil {
		return nil, err
	}
	if err := s.writeJournalEntryFiles(ctx, entry); err != nil {
		return nil, err
	}
	upload, err := s.journalPresigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.journalBucketName), Key: aws.String(entry.AudioKey), ContentType: aws.String(contentType),
		IfNoneMatch: aws.String("*"),
	}, func(options *s3.PresignOptions) { options.Expires = journalURLLifetime })
	if err != nil {
		return nil, err
	}
	return PostJournalEntries201JSONResponse{
		Entry: s.apiJournalEntry(ctx, entry),
		Upload: JournalUpload{
			Url: upload.URL, Method: JournalUploadMethod("PUT"), Headers: requestHeaders(upload.SignedHeader), ExpiresAt: expiresAt,
		},
	}, nil
}

func (s *Server) DeleteJournalEntriesEntryId(ctx context.Context, request DeleteJournalEntriesEntryIdRequestObject) (DeleteJournalEntriesEntryIdResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	records, err := s.listJournalRecords(ctx, subject)
	if err != nil {
		return nil, err
	}
	entryID := request.EntryId.String()
	var entry *JournalStoredEntry
	for _, record := range records {
		if record.When == journalEntryRecordKey(entryID) && record.Entry != nil {
			value := *record.Entry
			entry = &value
			break
		}
	}
	if entry == nil {
		return DeleteJournalEntriesEntryId204Response{}, nil
	}
	if entry.Status == JournalEntryStatusProcessing {
		return DeleteJournalEntriesEntryId409JSONResponse{
			Cause: "an entry cannot be deleted while it is being processed",
		}, nil
	}
	if err := s.deleteJournalEntry(ctx, subject, *entry); err != nil {
		return nil, err
	}
	if entry.Status == JournalEntryStatusReady {
		if err := s.refreshJournalSummariesForEntry(ctx, *entry); err != nil {
			return nil, err
		}
	}
	return DeleteJournalEntriesEntryId204Response{}, nil
}

func (s *Server) findJournalEntry(records []JournalStoredRecord, entryID string) (*JournalStoredEntry, error) {
	for _, record := range records {
		if record.When == journalEntryRecordKey(entryID) && record.Entry != nil {
			entry := *record.Entry
			return &entry, nil
		}
	}
	return nil, fmt.Errorf("journal entry %s was not initialized", entryID)
}

func (s *Server) updateJournalEntry(ctx context.Context, subject string, entry JournalStoredEntry) error {
	if err := s.putJournalRecord(ctx, JournalStoredRecord{
		Id: subject, When: journalEntryRecordKey(entry.Id), Kind: JournalStoredRecordKindEntry, Entry: &entry,
	}); err != nil {
		return err
	}
	return s.writeJournalEntryFiles(ctx, entry)
}

func (s *Server) claimJournalContentHash(ctx context.Context, subject, entryID, contentSHA256 string) (bool, error) {
	record := JournalStoredRecord{
		Id:   journalContentHashRecordKey(contentSHA256),
		When: subject,
		Kind: JournalStoredRecordKindContentHash,
		ContentHash: &JournalContentHashReservation{
			Sha256:  contentSHA256,
			EntryId: openapiUUID(entryID),
		},
	}
	item, err := attributevalue.MarshalMap(record)
	if err != nil {
		return false, err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(s.journalTableName),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(#id)"),
		ExpressionAttributeNames: map[string]string{
			"#id": "id",
		},
	})
	if err == nil {
		return true, nil
	}
	var conditionFailed *types.ConditionalCheckFailedException
	if !errors.As(err, &conditionFailed) {
		return false, err
	}
	existing, err := s.ddb.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.journalTableName),
		Key: map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: record.Id},
			"when": &types.AttributeValueMemberS{Value: record.When},
		},
	})
	if err != nil {
		return false, err
	}
	var reservation JournalStoredRecord
	if len(existing.Item) == 0 {
		return false, errors.New("journal content hash reservation disappeared")
	}
	if err := attributevalue.UnmarshalMap(existing.Item, &reservation); err != nil {
		return false, err
	}
	if reservation.ContentHash == nil {
		return false, errors.New("journal content hash key contains an invalid record")
	}
	return reservation.ContentHash.EntryId == openapiUUID(entryID), nil
}

func (s *Server) releaseJournalContentHash(ctx context.Context, subject, entryID, contentSHA256 string) error {
	if contentSHA256 == "" {
		return nil
	}
	_, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.journalTableName),
		Key: map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: journalContentHashRecordKey(contentSHA256)},
			"when": &types.AttributeValueMemberS{Value: subject},
		},
		ConditionExpression: aws.String("#content_hash.#entry_id = :entry_id"),
		ExpressionAttributeNames: map[string]string{
			"#content_hash": "content_hash",
			"#entry_id":     "entry_id",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":entry_id": &types.AttributeValueMemberS{Value: entryID},
		},
	})
	var conditionFailed *types.ConditionalCheckFailedException
	if errors.As(err, &conditionFailed) {
		return nil
	}
	return err
}

func (s *Server) deleteJournalEntry(ctx context.Context, subject string, entry JournalStoredEntry) error {
	for _, key := range []string{
		entry.AudioKey,
		"entries/" + entry.Id + "/metadata.json",
		"entries/" + entry.Id + "/transcript.json",
		"entries/" + entry.Id + "/summary.json",
	} {
		if _, err := s.journalObjects.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(s.journalBucketName),
			Key:    aws.String(key),
		}); err != nil {
			return err
		}
	}
	if err := s.releaseJournalContentHash(ctx, subject, entry.Id, entry.ContentSha256); err != nil {
		return err
	}
	_, err := s.ddb.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.journalTableName),
		Key: map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: subject},
			"when": &types.AttributeValueMemberS{Value: journalEntryRecordKey(entry.Id)},
		},
	})
	return err
}

func (s *Server) journalObjectSHA256(ctx context.Context, bucket, key string, size int64) (string, error) {
	object, err := s.journalObjects.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket), Key: aws.String(key),
	})
	if err != nil {
		return "", err
	}
	defer object.Body.Close()
	if object.ContentLength != nil && *object.ContentLength != size {
		return "", fmt.Errorf("downloaded audio length %d does not match S3 event length %d", *object.ContentLength, size)
	}
	hash := sha256.New()
	read, err := io.Copy(hash, io.LimitReader(object.Body, size+1))
	if err != nil {
		return "", err
	}
	if read != size {
		return "", fmt.Errorf("downloaded audio length %d does not match S3 event length %d", read, size)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

func (s *Server) failJournalEntry(ctx context.Context, subject string, entry JournalStoredEntry, cause error) error {
	entry.Status = JournalEntryStatusFailed
	entry.Error = cause.Error()
	if err := s.updateJournalEntry(ctx, subject, entry); err != nil {
		return err
	}
	return s.releaseJournalContentHash(ctx, subject, entry.Id, entry.ContentSha256)
}

type journalSummaryCandidate struct {
	at       time.Time
	location *time.Location
}

var journalAggregatePeriods = []JournalSummaryPeriod{
	JournalSummaryPeriodDay,
	JournalSummaryPeriodWeek,
	JournalSummaryPeriodMonth,
	JournalSummaryPeriodYear,
}

func (s *Server) refreshJournalSummariesForEntry(ctx context.Context, entry JournalStoredEntry) error {
	s.journalHierarchyMu.Lock()
	defer s.journalHierarchyMu.Unlock()
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		return err
	}
	location, err := time.LoadLocation(entry.TimeZone)
	if err != nil {
		return err
	}
	for _, period := range journalAggregatePeriods {
		records, err = s.refreshJournalSummary(ctx, journalOwnerSubject, period, entry.RecordedAt, location, records)
		if err != nil {
			return err
		}
	}
	return nil
}

// RefreshJournalSummaries creates summaries only for elapsed calendar periods.
func (s *Server) RefreshJournalSummaries(ctx context.Context, now time.Time) error {
	s.journalHierarchyMu.Lock()
	defer s.journalHierarchyMu.Unlock()
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		return err
	}
	candidates := make(map[JournalSummaryPeriod]map[string]journalSummaryCandidate, len(journalAggregatePeriods))
	for _, period := range journalAggregatePeriods {
		candidates[period] = map[string]journalSummaryCandidate{}
	}
	for _, record := range records {
		if record.Entry == nil || record.Entry.Status != JournalEntryStatusReady {
			continue
		}
		entry := record.Entry
		location, err := time.LoadLocation(entry.TimeZone)
		if err != nil {
			return err
		}
		for _, period := range journalAggregatePeriods {
			start, end := periodBounds(entry.RecordedAt, location, string(period))
			if now.Before(end) {
				continue
			}
			candidates[period][start.Format(time.RFC3339)] = journalSummaryCandidate{at: entry.RecordedAt, location: location}
		}
	}
	for _, period := range journalAggregatePeriods {
		keys := make([]string, 0, len(candidates[period]))
		for key := range candidates[period] {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			candidate := candidates[period][key]
			records, err = s.refreshJournalSummary(ctx, journalOwnerSubject, period, candidate.at, candidate.location, records)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// ProcessJournalUpload completes the expensive journal work after S3 has
// durably accepted a browser upload. Repeated S3 notifications are safe.
func (s *Server) ProcessJournalUpload(ctx context.Context, bucket, key string, size int64) error {
	if bucket != s.journalBucketName {
		return fmt.Errorf("unexpected journal bucket %q", bucket)
	}
	entryID, ok := journalEntryIDFromKey(key)
	if !ok {
		return nil
	}
	records, err := s.listJournalRecords(ctx, journalOwnerSubject)
	if err != nil {
		return err
	}
	entry, err := s.findJournalEntry(records, entryID)
	if err != nil {
		return err
	}
	if entry.Status == JournalEntryStatusReady {
		return s.refreshJournalSummariesForEntry(ctx, *entry)
	}
	entry.ByteLength = size
	if size <= 0 || size > maxJournalAudioBytes {
		cause := fmt.Errorf("uploaded audio length %d is outside the allowed range of 1 byte to 25 MiB", size)
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, cause)
		return cause
	}
	contentSHA256, err := s.journalObjectSHA256(ctx, bucket, key, size)
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	entry.ContentSha256 = contentSHA256
	owned, err := s.claimJournalContentHash(ctx, journalOwnerSubject, entry.Id, contentSHA256)
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	if !owned {
		return s.deleteJournalEntry(ctx, journalOwnerSubject, *entry)
	}
	entry.Status = JournalEntryStatusProcessing
	entry.Error = ""
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, *entry); err != nil {
		return err
	}
	object, err := s.journalObjects.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket), Key: aws.String(key),
	})
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	defer object.Body.Close()
	if object.ContentLength != nil && *object.ContentLength != size {
		cause := fmt.Errorf("downloaded audio length %d does not match S3 event length %d", *object.ContentLength, size)
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, cause)
		return cause
	}
	audio := io.Reader(io.LimitReader(object.Body, size))
	finishMetadata := func() (time.Time, bool) { return time.Time{}, false }
	if entry.ContentType == "audio/mp4" {
		audio, finishMetadata = observeQuickTimeCreationTime(audio)
	}
	transcription, err := s.journalAI.Transcribe(ctx, audio, entry.ContentType)
	recordedAt, hasRecordedAt := finishMetadata()
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	if hasRecordedAt {
		entry.RecordedAt = recordedAt
	}
	entry.DurationMs = transcription.DurationMs
	sources := transcriptSources(entry.Id, transcription.Segments)
	result, err := s.journalAI.Summarize(ctx, "entry", sources)
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	entry.Transcript = transcription.Segments
	sourceFingerprint, err := summarySourceFingerprint(sources)
	if err != nil {
		_ = s.failJournalEntry(ctx, journalOwnerSubject, *entry, err)
		return err
	}
	entry.Summary = ptr(summaryRecord(
		"entry:"+entry.Id,
		JournalSummaryPeriodEntry,
		entry.RecordedAt,
		entry.RecordedAt.Add(time.Duration(entry.DurationMs)*time.Millisecond),
		result,
		sourceFingerprint,
	))
	entry.Status = JournalEntryStatusReady
	if err := s.updateJournalEntry(ctx, journalOwnerSubject, *entry); err != nil {
		return err
	}
	return s.refreshJournalSummariesForEntry(ctx, *entry)
}

func ptr[T any](value T) *T { return &value }
