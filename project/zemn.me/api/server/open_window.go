package apiserver

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const openWindowPartitionKey = "OPEN_WINDOW"

// authCtxKey is used to store the Authorization header in the request context.
type authCtxKey struct{}

type OpenWindowRecord struct {
	Id    string `dynamodbav:"id"`
	Who   string `dynamodbav:"who"`
	Until Time   `dynamodbav:"until"`
}

func (s Server) createOpenWindow(ctx context.Context, rec OpenWindowRecord) error {
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.openWindowTableName),
		Item:      item,
	})
	return err
}

func (s Server) isDoorOpen(ctx context.Context) (bool, error) {
	if s.ddb == nil || s.openWindowTableName == "" {
		return false, nil
	}
	now := Now()
	input := &dynamodb.QueryInput{
		TableName:              aws.String(s.openWindowTableName),
		KeyConditionExpression: aws.String("id = :id AND until >= :now"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id":  &types.AttributeValueMemberS{Value: openWindowPartitionKey},
			":now": &types.AttributeValueMemberS{Value: now.Time.Format(time.RFC3339Nano)},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(10),
	}
	result, err := s.ddb.Query(ctx, input)
	if err != nil {
		return false, err
	}
	return len(result.Items) > 0, nil
}

func getAuthToken(ctx context.Context) string {
	if v, ok := ctx.Value(authCtxKey{}).(string); ok {
		return v
	}
	return ""
}

func (s Server) PostCallboxOpen(ctx context.Context, rq PostCallboxOpenRequestObject) (PostCallboxOpenResponseObject, error) {
	who := getAuthToken(ctx)
	until := Time{Time: time.Now().Add(5 * time.Minute)}
	err := s.createOpenWindow(ctx, OpenWindowRecord{Id: openWindowPartitionKey, Who: who, Until: until})
	if err != nil {
		return nil, err
	}
	return PostCallboxOpen200JSONResponse(OpenWindowResponse{OpenUntil: until.Time, Who: &who}), nil
}
