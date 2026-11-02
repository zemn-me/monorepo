package apiserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const callboxKeyPartition = "CALLBOX_KEY_REQUESTS"
const callboxDoorOpenPartition = "CALLBOX_DOOR_OPEN_EVENTS"
const doorOpenDuration = 2 * time.Minute
const defaultCallboxEventsLimit = 32
const maxCallboxEventsLimit = 100

type KeyRequestRecord struct {
	Id      string `dynamodbav:"id"`
	When    Time   `dynamodbav:"when"`
	Subject string `dynamodbav:"subject"`
	Source  string `dynamodbav:"source,omitempty"`
	Active  *bool  `dynamodbav:"active,omitempty"`
}

type DoorOpenRecord struct {
	Id      string `dynamodbav:"id"`
	When    Time   `dynamodbav:"when"`
	Source  string `dynamodbav:"source"`
	Subject string `dynamodbav:"subject,omitempty"`
	Open    *bool  `dynamodbav:"open,omitempty"`
}

func boolPtr(v bool) *bool {
	return &v
}

func (s Server) recordKeyRequest(ctx context.Context, subject string) error {
	if s.keyRequestsTableName == "" {
		return errors.New("callbox key table not configured")
	}

	rec := KeyRequestRecord{
		Id:      callboxKeyPartition,
		When:    Now(),
		Subject: subject,
		Active:  boolPtr(true),
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.keyRequestsTableName),
		Item:      item,
	})
	return err
}

func (s Server) cancelKeyRequest(ctx context.Context, subject string) error {
	if s.keyRequestsTableName == "" {
		return errors.New("callbox key table not configured")
	}

	rec := KeyRequestRecord{
		Id:      callboxKeyPartition,
		When:    Now(),
		Subject: subject,
		Source:  "web_key_lock",
		Active:  boolPtr(false),
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.keyRequestsTableName),
		Item:      item,
	})
	return err
}

func (s Server) recordDoorOpenSignal(ctx context.Context, source, subject string) error {
	return s.recordDoorStateSignal(ctx, true, source, subject)
}

func (s Server) recordDoorStateSignal(ctx context.Context, open bool, source, subject string) error {
	if s.keyRequestsTableName == "" {
		return errors.New("callbox key table not configured")
	}
	rec := DoorOpenRecord{
		Id:      callboxDoorOpenPartition,
		When:    Now(),
		Source:  source,
		Subject: subject,
		Open:    &open,
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.keyRequestsTableName),
		Item:      item,
	})
	return err
}

func (s Server) latestKeyRequest(ctx context.Context) (*KeyRequestRecord, error) {
	if s.keyRequestsTableName == "" {
		return nil, nil
	}

	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.keyRequestsTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: callboxKeyPartition},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(1),
	}
	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return nil, err
	}
	if len(result.Items) == 0 {
		return nil, nil
	}

	var rec KeyRequestRecord
	if err := attributevalue.UnmarshalMap(result.Items[0], &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func doorOpenRecordIsOpen(rec *DoorOpenRecord) bool {
	return rec.Open == nil || *rec.Open
}

type callboxEventsCursor struct {
	Id   string `json:"id"`
	When string `json:"when"`
}

func encodeCallboxEventsCursor(key map[string]types.AttributeValue) (*string, error) {
	if len(key) == 0 {
		return nil, nil
	}
	id, ok := key["id"].(*types.AttributeValueMemberS)
	if !ok {
		return nil, errors.New("callbox events cursor missing id")
	}
	when, ok := key["when"].(*types.AttributeValueMemberS)
	if !ok {
		return nil, errors.New("callbox events cursor missing when")
	}
	payload, err := json.Marshal(callboxEventsCursor{
		Id:   id.Value,
		When: when.Value,
	})
	if err != nil {
		return nil, err
	}
	cursor := base64.RawURLEncoding.EncodeToString(payload)
	return &cursor, nil
}

func decodeCallboxEventsCursor(cursor *string) (map[string]types.AttributeValue, error) {
	if cursor == nil || *cursor == "" {
		return nil, nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(*cursor)
	if err != nil {
		return nil, fmt.Errorf("decode callbox events cursor: %w", err)
	}
	var decoded callboxEventsCursor
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, fmt.Errorf("unmarshal callbox events cursor: %w", err)
	}
	if decoded.Id == "" || decoded.When == "" {
		return nil, errors.New("callbox events cursor requires id and when")
	}
	return map[string]types.AttributeValue{
		"id":   &types.AttributeValueMemberS{Value: decoded.Id},
		"when": &types.AttributeValueMemberS{Value: decoded.When},
	}, nil
}

func callboxEventsLimit(limit *int) int32 {
	if limit == nil {
		return defaultCallboxEventsLimit
	}
	if *limit < 1 {
		return 1
	}
	if *limit > maxCallboxEventsLimit {
		return maxCallboxEventsLimit
	}
	return int32(*limit)
}

func callboxAction(open bool) CallboxEventAction {
	if open {
		return Unlocked
	}
	return Locked
}

func defaultCallboxActor(source, subject string) string {
	if subject != "" {
		parts := strings.FieldsFunc(subject, func(r rune) bool {
			return r == '-' || r == '_' || r == '.'
		})
		for i, part := range parts {
			if part == "" {
				continue
			}
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
		if len(parts) > 0 {
			return strings.Join(parts, " ")
		}
		return subject
	}
	switch source {
	case "entry_code":
		return "Entry code"
	case "party_mode":
		return "Party mode"
	case "web_key_lock", "web_key_request":
		return "Web key"
	default:
		if source == "" {
			return "Callbox"
		}
		return strings.Join(strings.FieldsFunc(source, func(r rune) bool {
			return r == '-' || r == '_'
		}), " ")
	}
}

func displayNameForUser(rec userRecord) string {
	if rec.GivenName != "" || rec.FamilyName != "" {
		return strings.TrimSpace(strings.Join([]string{rec.GivenName, rec.FamilyName}, " "))
	}
	if rec.Name != "" {
		return rec.Name
	}
	if len(rec.Emails) > 0 && rec.Emails[0] != "" {
		return rec.Emails[0]
	}
	if rec.Id != "" {
		return defaultCallboxActor("", rec.Id)
	}
	return ""
}

type callboxActorDetails struct {
	Actor      string
	Email      *string
	GivenName  *string
	FamilyName *string
}

func actorDetailsFromUserRecord(source, subject string, rec userRecord) callboxActorDetails {
	details := callboxActorDetails{
		Actor: defaultCallboxActor(source, subject),
	}
	if name := displayNameForUser(rec); name != "" {
		details.Actor = name
	}
	if len(rec.Emails) > 0 && rec.Emails[0] != "" {
		email := rec.Emails[0]
		details.Email = &email
	}
	if rec.GivenName != "" {
		details.GivenName = &rec.GivenName
	}
	if rec.FamilyName != "" {
		details.FamilyName = &rec.FamilyName
	}
	return details
}

func actorDetailsFromIDToken(source, subject string, token *auth.IDToken) callboxActorDetails {
	rec := userRecord{
		Id:         subject,
		Emails:     []string{token.Email},
		GivenName:  token.GivenName,
		FamilyName: token.FamilyName,
	}
	return actorDetailsFromUserRecord(source, subject, rec)
}

func (s Server) callboxActor(ctx context.Context, source, subject string) callboxActorDetails {
	fallback := callboxActorDetails{Actor: defaultCallboxActor(source, subject)}
	if subject == "" {
		return fallback
	}
	if s.usersTableName != "" {
		rec, err := s.findUserByLocalID(ctx, subject)
		if err == nil && rec != nil {
			return actorDetailsFromUserRecord(source, subject, *rec)
		}
	}
	if info, ok := auth.UserInfoFromContext(ctx); ok && info != nil && info.Subject == subject {
		return actorDetailsFromIDToken(source, subject, info)
	}
	return fallback
}

func (s Server) GetCallboxEvents(ctx context.Context, rq GetCallboxEventsRequestObject) (GetCallboxEventsResponseObject, error) {
	if s.keyRequestsTableName == "" {
		return GetCallboxEvents200JSONResponse{Events: []CallboxEvent{}}, nil
	}

	cursor, err := decodeCallboxEventsCursor(rq.Params.Cursor)
	if err != nil {
		return nil, err
	}
	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.keyRequestsTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: callboxDoorOpenPartition},
		},
		ExclusiveStartKey: cursor,
		ScanIndexForward:  aws.Bool(false),
		Limit:             aws.Int32(callboxEventsLimit(rq.Params.Limit)),
	}
	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return nil, err
	}

	var records []DoorOpenRecord
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &records); err != nil {
		return nil, err
	}
	events := make([]CallboxEvent, 0, len(records))
	for _, rec := range records {
		open := doorOpenRecordIsOpen(&rec)
		actor := s.callboxActor(ctx, rec.Source, rec.Subject)
		event := CallboxEvent{
			Id:              fmt.Sprintf("%s#%s", rec.Id, rec.When.String()),
			When:            rec.When.Time.UTC(),
			Open:            open,
			Actor:           actor.Actor,
			ActorEmail:      actor.Email,
			ActorGivenName:  actor.GivenName,
			ActorFamilyName: actor.FamilyName,
			Action:          callboxAction(open),
		}
		if rec.Source != "" {
			source := rec.Source
			event.Source = &source
		}
		if rec.Subject != "" {
			subject := rec.Subject
			event.Subject = &subject
		}
		events = append(events, event)
	}
	nextCursor, err := encodeCallboxEventsCursor(result.LastEvaluatedKey)
	if err != nil {
		return nil, err
	}
	return GetCallboxEvents200JSONResponse{
		Events:     events,
		NextCursor: nextCursor,
	}, nil
}

func (s Server) latestDoorOpenSignal(ctx context.Context) (*DoorOpenRecord, error) {
	if s.keyRequestsTableName == "" {
		return nil, nil
	}

	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.keyRequestsTableName),
		KeyConditionExpression: aws.String("id = :id"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id": &types.AttributeValueMemberS{Value: callboxDoorOpenPartition},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(1),
	}
	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return nil, err
	}
	if len(result.Items) == 0 {
		return nil, nil
	}

	var rec DoorOpenRecord
	if err := attributevalue.UnmarshalMap(result.Items[0], &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (s Server) hasRecentKeyRequest(ctx context.Context, within time.Duration) (bool, *KeyRequestRecord, error) {
	rec, err := s.latestKeyRequest(ctx)
	if err != nil || rec == nil {
		return false, rec, err
	}
	if rec.Active != nil && !*rec.Active {
		return false, rec, nil
	}
	return time.Since(rec.When.Time) <= within, rec, nil
}

func (s Server) currentDoorOpenStatus(ctx context.Context, within time.Duration) (bool, *DoorOpenRecord, time.Duration, error) {
	rec, err := s.latestDoorOpenSignal(ctx)
	if err != nil || rec == nil {
		return false, rec, 0, err
	}
	if !doorOpenRecordIsOpen(rec) {
		return false, rec, 0, nil
	}
	remaining := within - time.Since(rec.When.Time)
	if remaining <= 0 {
		return false, rec, 0, nil
	}
	return true, rec, remaining, nil
}

func (s Server) PostCallbox(ctx context.Context, rq PostCallboxRequestObject) (PostCallboxResponseObject, error) {
	if rq.Body == nil {
		return nil, errors.New("POST /callbox requires a body")
	}

	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return nil, errors.New("missing subject in context")
	}

	if !rq.Body.Open {
		if err := s.cancelKeyRequest(ctx, info.Subject); err != nil {
			return nil, err
		}
		if err := s.recordDoorStateSignal(ctx, false, "web_key_lock", info.Subject); err != nil {
			return nil, err
		}
		rec, err := s.latestDoorOpenSignal(ctx)
		if err != nil || rec == nil {
			return nil, errors.New("failed to read lock request")
		}
		return PostCallbox200JSONResponse{
			Subject: rec.Subject,
			When:    rec.When.String(),
		}, nil
	}

	if err := s.recordKeyRequest(ctx, info.Subject); err != nil {
		return nil, err
	}
	if err := s.recordDoorOpenSignal(ctx, "web_key_request", info.Subject); err != nil {
		return nil, err
	}
	rec, err := s.latestKeyRequest(ctx)
	if err != nil || rec == nil {
		return nil, errors.New("failed to read key request")
	}
	return PostCallbox200JSONResponse{
		Subject: rec.Subject,
		When:    rec.When.String(),
	}, nil
}

func (s Server) GetCallbox(ctx context.Context, rq GetCallboxRequestObject) (GetCallboxResponseObject, error) {
	open, rec, _, err := s.currentDoorOpenStatus(ctx, doorOpenDuration)
	if err != nil {
		return nil, err
	}
	resp := GetCallbox200JSONResponse{
		Open: open,
	}
	if rec != nil {
		if doorOpenRecordIsOpen(rec) {
			last := rec.When.Time.UTC().Format(time.RFC3339)
			resp.LastOpenedAt = &last
		}
		source := rec.Source
		resp.Source = &source
		if rec.Subject != "" {
			subject := rec.Subject
			resp.Subject = &subject
		}
		if open {
			until := rec.When.Time.Add(doorOpenDuration).UTC().Format(time.RFC3339)
			resp.OpenUntil = &until
		}
	}
	return resp, nil
}
