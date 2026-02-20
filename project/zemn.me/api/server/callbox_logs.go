package apiserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
)

const (
	CallboxLogPartitionKeyValue = "CALLBOX_LOGS_1"
)

type CallboxLogRecord struct {
	Id      string            `dynamodbav:"id"`
	LogId   string            `dynamodbav:"log_id"`
	When    Time              `dynamodbav:"when"`
	Kind    string            `dynamodbav:"kind"`
	Message string            `dynamodbav:"message"`
	Digits  string            `dynamodbav:"digits,omitempty"`
	Number  string            `dynamodbav:"number,omitempty"`
	Status  string            `dynamodbav:"status,omitempty"`
	Attempt *int              `dynamodbav:"attempt,omitempty"`
	From    string            `dynamodbav:"from,omitempty"`
	To      string            `dynamodbav:"to,omitempty"`
	Settings *CallboxSettings `dynamodbav:"settings,omitempty"`
}

func (s Server) appendCallboxLog(ctx context.Context, rec CallboxLogRecord) {
	if s.settingsTableName == "" {
		return
	}
	if rec.LogId == "" {
		rec.LogId = uuid.NewString()
	}
	rec.Id = CallboxLogPartitionKeyValue
	rec.When = Now()
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		s.log.Printf("failed to marshal callbox log record: %v", err)
		return
	}
	if _, err := s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.settingsTableName),
		Item:      item,
	}); err != nil {
		s.log.Printf("failed to write callbox log record: %v", err)
	}
}

type callboxLogCursor struct {
	When string `json:"when"`
	Id   string `json:"id,omitempty"`
}

func encodeCallboxLogCursor(rec CallboxLogRecord) (string, error) {
	payload, err := json.Marshal(callboxLogCursor{When: rec.When.String(), Id: rec.LogId})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func decodeCallboxLogCursor(cursor *string) (*callboxLogCursor, error) {
	if cursor == nil || *cursor == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(*cursor)
	if err != nil {
		return nil, err
	}
	var decoded callboxLogCursor
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, err
	}
	if decoded.When == "" {
		return nil, errors.New("cursor missing when")
	}
	return &decoded, nil
}

func (s Server) getCallboxLogRecords(ctx context.Context, limit int32, cursor *string) ([]CallboxLogRecord, string, error) {
	if s.settingsTableName == "" || limit <= 0 {
		return nil, "", nil
	}
	decodedCursor, err := decodeCallboxLogCursor(cursor)
	if err != nil {
		return nil, "", err
	}
	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.settingsTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: CallboxLogPartitionKeyValue},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(limit),
	}
	if decodedCursor != nil {
		input.ExclusiveStartKey = map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: CallboxLogPartitionKeyValue},
			"when": &types.AttributeValueMemberS{Value: decodedCursor.When},
		}
	}

	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return nil, "", err
	}
	var recs []CallboxLogRecord
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &recs); err != nil {
		return nil, "", err
	}
	nextCursor := ""
	if len(recs) > 0 && result.LastEvaluatedKey != nil {
		if cur, err := encodeCallboxLogCursor(recs[len(recs)-1]); err == nil {
			nextCursor = cur
		}
	}
	return recs, nextCursor, nil
}

func clampLogLimit(limit *int) int32 {
	const defaultLimit int32 = 100
	const maxLimit int32 = 200
	if limit == nil {
		return defaultLimit
	}
	if *limit <= 0 {
		return defaultLimit
	}
	if int32(*limit) > maxLimit {
		return maxLimit
	}
	return int32(*limit)
}

func (s Server) GetCallboxLogs(ctx context.Context, rq GetCallboxLogsRequestObject) (GetCallboxLogsResponseObject, error) {
	limit := clampLogLimit(rq.Params.Limit)

	logs, nextCursor, err := s.getCallboxLogRecords(ctx, limit, rq.Params.Cursor)
	if err != nil {
		return nil, err
	}

	parseLogId := func(rec CallboxLogRecord) (uuid.UUID, bool) {
		if rec.LogId == "" {
			return uuid.Nil, false
		}
		id, err := uuid.Parse(rec.LogId)
		if err != nil {
			return uuid.Nil, false
		}
		return id, true
	}

	entries := make([]CallboxLogEntry, 0, len(logs))
	for _, rec := range logs {
		id, ok := parseLogId(rec)
		if !ok {
			continue
		}
		entry := CallboxLogEntry{}
		switch rec.Kind {
		case "call_received":
			var from *string
			if rec.From != "" {
				from = &rec.From
			}
			var to *string
			if rec.To != "" {
				to = &rec.To
			}
			value := CallboxLogEntryCallReceived{
				Id:      id,
				When:    rec.When.Time,
				Kind:    CallReceived,
				Message: rec.Message,
				From:    from,
				To:      to,
			}
			if err := entry.FromCallboxLogEntryCallReceived(value); err == nil {
				entries = append(entries, entry)
			}
		case "entry_party_mode":
			value := CallboxLogEntryPartyMode{
				Id:      id,
				When:    rec.When.Time,
				Kind:    EntryPartyMode,
				Message: rec.Message,
			}
			if err := entry.FromCallboxLogEntryPartyMode(value); err == nil {
				entries = append(entries, entry)
			}
		case "entry_code_denied":
			value := CallboxLogEntryCodeDenied{
				Id:      id,
				When:    rec.When.Time,
				Kind:    EntryCodeDenied,
				Message: rec.Message,
				Digits:  rec.Digits,
			}
			if err := entry.FromCallboxLogEntryCodeDenied(value); err == nil {
				entries = append(entries, entry)
			}
		case "entry_code_allowed":
			value := CallboxLogEntryCodeAllowed{
				Id:      id,
				When:    rec.When.Time,
				Kind:    EntryCodeAllowed,
				Message: rec.Message,
				Digits:  rec.Digits,
			}
			if err := entry.FromCallboxLogEntryCodeAllowed(value); err == nil {
				entries = append(entries, entry)
			}
		case "entry_authorizer_dial":
			attempt := 0
			if rec.Attempt != nil {
				attempt = *rec.Attempt
			}
			value := CallboxLogEntryAuthorizerDial{
				Id:      id,
				When:    rec.When.Time,
				Kind:    EntryAuthorizerDial,
				Message: rec.Message,
				Number:  rec.Number,
				Attempt: attempt,
			}
			if err := entry.FromCallboxLogEntryAuthorizerDial(value); err == nil {
				entries = append(entries, entry)
			}
		case "entry_authorizer_status":
			attempt := 0
			if rec.Attempt != nil {
				attempt = *rec.Attempt
			}
			value := CallboxLogEntryAuthorizerStatus{
				Id:      id,
				When:    rec.When.Time,
				Kind:    EntryAuthorizerStatus,
				Message: rec.Message,
				Status:  rec.Status,
				Attempt: attempt,
			}
			if err := entry.FromCallboxLogEntryAuthorizerStatus(value); err == nil {
				entries = append(entries, entry)
			}
		case "settings_update":
			if rec.Settings == nil {
				continue
			}
			value := CallboxLogEntrySettingsUpdate{
				Id:       id,
				When:     rec.When.Time,
				Kind:     SettingsUpdate,
				Message:  rec.Message,
				Settings: *rec.Settings,
			}
			if err := entry.FromCallboxLogEntrySettingsUpdate(value); err == nil {
				entries = append(entries, entry)
			}
		default:
			continue
		}
	}

	response := CallboxLogPage{
		Items: entries,
	}
	if nextCursor != "" {
		response.NextCursor = &nextCursor
	}

	return GetCallboxLogs200JSONResponse(response), nil
}
