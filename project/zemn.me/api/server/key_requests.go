package apiserver

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

const callboxKeyPartition = "CALLBOX_KEY_REQUESTS"
const callboxDoorOpenPartition = "CALLBOX_DOOR_OPEN_EVENTS"
const doorOpenDuration = 2 * time.Minute

type KeyRequestRecord struct {
	Id      string `dynamodbav:"id"`
	When    Time   `dynamodbav:"when"`
	Subject string `dynamodbav:"subject"`
	Source  string `dynamodbav:"source,omitempty"`
}

type DoorOpenRecord struct {
	Id      string `dynamodbav:"id"`
	When    Time   `dynamodbav:"when"`
	Source  string `dynamodbav:"source"`
	Subject string `dynamodbav:"subject,omitempty"`
}

func (s Server) recordKeyRequest(ctx context.Context, subject string) error {
	if s.keyRequestsTableName == "" {
		return errors.New("callbox key table not configured")
	}

	rec := KeyRequestRecord{
		Id:      callboxKeyPartition,
		When:    Now(),
		Subject: subject,
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
	if s.keyRequestsTableName == "" {
		return errors.New("callbox key table not configured")
	}
	rec := DoorOpenRecord{
		Id:      callboxDoorOpenPartition,
		When:    Now(),
		Source:  source,
		Subject: subject,
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
	return time.Since(rec.When.Time) <= within, rec, nil
}

func (s Server) currentDoorOpenStatus(ctx context.Context, within time.Duration) (bool, *DoorOpenRecord, time.Duration, error) {
	rec, err := s.latestDoorOpenSignal(ctx)
	if err != nil || rec == nil {
		return false, rec, 0, err
	}
	remaining := within - time.Since(rec.When.Time)
	if remaining <= 0 {
		return false, rec, 0, nil
	}
	return true, rec, remaining, nil
}

func (s Server) PostCallbox(ctx context.Context, rq PostCallboxRequestObject) (PostCallboxResponseObject, error) {
	if rq.Body == nil || !rq.Body.Open {
		return nil, errors.New("POST /callbox requires open=true")
	}

	info, ok := auth.UserInfoFromContext(ctx)
	if !ok || info == nil || info.Subject == "" {
		return nil, errors.New("missing subject in context")
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
		last := rec.When.Time.UTC().Format(time.RFC3339)
		resp.LastOpenedAt = &last
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
