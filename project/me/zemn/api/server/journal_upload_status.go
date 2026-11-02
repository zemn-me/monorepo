package apiserver

import (
	"context"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func (s *Server) journalMetadataQuery(subject string) *dynamodb.QueryInput {
	return &dynamodb.QueryInput{
		TableName: aws.String(s.journalTableName), ConsistentRead: aws.Bool(true),
		KeyConditionExpression:    aws.String("#id = :id AND begins_with(#when, :prefix)"),
		ExpressionAttributeNames:  map[string]string{"#id": "id", "#when": "when", "#entry": "entry", "#status": "status"},
		ExpressionAttributeValues: map[string]types.AttributeValue{":id": &types.AttributeValueMemberS{Value: subject}, ":prefix": &types.AttributeValueMemberS{Value: "ENTRY#"}},
	}
}

func (s *Server) journalHasEntries(ctx context.Context, subject string) (bool, error) {
	input := s.journalMetadataQuery(subject)
	input.Limit = aws.Int32(1)
	input.ProjectionExpression = aws.String("#entry.#status, #entry.upload_expires_at")
	now := time.Now().UTC()
	for {
		result, err := s.ddb.Query(ctx, input)
		if err != nil {
			return false, err
		}
		for _, item := range result.Items {
			var record JournalStoredRecord
			if err := attributevalue.UnmarshalMap(item, &record); err != nil {
				return false, err
			}
			if record.Entry != nil && journalEntryIsVisible(*record.Entry, now) {
				return true, nil
			}
		}
		if len(result.LastEvaluatedKey) == 0 {
			return false, nil
		}
		input.ExclusiveStartKey = result.LastEvaluatedKey
	}
}

func (s *Server) GetJournalEntries(ctx context.Context, _ GetJournalEntriesRequestObject) (GetJournalEntriesResponseObject, error) {
	subject, err := journalSubject(ctx)
	if err != nil {
		return nil, err
	}
	input := s.journalMetadataQuery(subject)
	input.ExpressionAttributeNames["#progress"] = "processing_progress"
	input.ExpressionAttributeNames["#error"] = "error"
	input.ExpressionAttributeNames["#title"] = "title"
	input.ProjectionExpression = aws.String("#entry.schema_version, #entry.#id, #entry.recorded_at, #entry.recording_started_at, #entry.time_zone, #entry.content_type, #entry.byte_length, #entry.content_sha256, #entry.#status, #entry.upload_expires_at, #entry.#progress, #entry.#error, #entry.#title")
	entries := []JournalEntry{}
	now := time.Now().UTC()
	for {
		result, err := s.ddb.Query(ctx, input)
		if err != nil {
			return nil, err
		}
		for _, item := range result.Items {
			var record JournalStoredRecord
			if err := attributevalue.UnmarshalMap(item, &record); err != nil {
				return nil, err
			}
			if record.Entry == nil || !journalEntryIsVisible(*record.Entry, now) {
				continue
			}
			entry := *record.Entry
			entry.Transcript, entry.Summary, entry.AudioKey = []JournalTranscriptSegment{}, nil, ""
			entries = append(entries, s.apiJournalEntry(ctx, entry))
		}
		if len(result.LastEvaluatedKey) == 0 {
			break
		}
		input.ExclusiveStartKey = result.LastEvaluatedKey
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].RecordedAt.After(entries[j].RecordedAt) })
	return GetJournalEntries200JSONResponse{Entries: entries}, nil
}
