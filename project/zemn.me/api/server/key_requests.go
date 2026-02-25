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

type KeyRequestRecord struct {
	Id      string `dynamodbav:"id"`
	When    Time   `dynamodbav:"when"`
	Subject string `dynamodbav:"subject"`
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

func (s Server) hasRecentKeyRequest(ctx context.Context, within time.Duration) (bool, *KeyRequestRecord, error) {
	rec, err := s.latestKeyRequest(ctx)
	if err != nil || rec == nil {
		return false, rec, err
	}
	return time.Since(rec.When.Time) <= within, rec, nil
}

func (s Server) PostMeKey(ctx context.Context, rq PostMeKeyRequestObject) (PostMeKeyResponseObject, error) {
	subject, ok := auth.SubjectFromContext(ctx)
	if !ok {
		return nil, errors.New("missing subject in context")
	}
	if err := s.recordKeyRequest(ctx, subject); err != nil {
		return nil, err
	}
	rec, err := s.latestKeyRequest(ctx)
	if err != nil || rec == nil {
		return nil, errors.New("failed to read key request")
	}
	return PostMeKey200JSONResponse{
		Subject: rec.Subject,
		When:    rec.When.String(),
	}, nil
}
