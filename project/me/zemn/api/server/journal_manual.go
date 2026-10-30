package apiserver

import (
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
)

// RunJournalCuration admits one IAM-authorized manual test, independently of the
// daily schedule. A request ID is permanently bound to its first run; replays
// cannot start fresh paid work even after cleanup or a later manual test.
func (s *Server) RunJournalCuration(ctx context.Context, now time.Time, requestID string) error {
	parsed, err := uuid.Parse(requestID)
	if err != nil || parsed == uuid.Nil || parsed.String() != requestID {
		return errors.New("manual journal request ID must be a canonical nonzero UUID")
	}
	return s.refreshJournalKnowledge(ctx, now, requestID)
}

func journalManualRequestKey(requestID string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"id":   &types.AttributeValueMemberS{Value: journalOwnerSubject},
		"when": &types.AttributeValueMemberS{Value: "CURATION_MANUAL#" + requestID},
	}
}

func (s *Server) journalManualRequestRun(ctx context.Context, requestID string) (string, error) {
	result, err := s.ddb.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.journalTableName), Key: journalManualRequestKey(requestID), ConsistentRead: aws.Bool(true)})
	if err != nil {
		return "", err
	}
	if len(result.Item) == 0 {
		return "", nil
	}
	run, ok := result.Item["run_id"].(*types.AttributeValueMemberS)
	if !ok || run.Value == "" {
		return "", errors.New("manual journal request has an invalid checkpoint")
	}
	return run.Value, nil
}

func (s *Server) claimJournalManualRequest(ctx context.Context, state *journalCurationState, now time.Time) error {
	item := journalManualRequestKey(state.ManualRequestID)
	item["run_id"] = &types.AttributeValueMemberS{Value: state.RunID}
	item["requested_at"] = &types.AttributeValueMemberS{Value: now.Format(time.RFC3339)}
	_, err := s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.journalTableName), Item: item,
		ConditionExpression: aws.String("attribute_not_exists(#when)"), ExpressionAttributeNames: map[string]string{"#when": "when"},
	})
	var conflict *types.ConditionalCheckFailedException
	if errors.As(err, &conflict) {
		previous, readErr := s.journalManualRequestRun(ctx, state.ManualRequestID)
		if readErr != nil {
			return readErr
		}
		if previous == state.RunID {
			return nil
		}
		state.Cleaning, state.Failed = true, true
		return errors.New("manual journal request is already bound to another run")
	}
	return err
}
