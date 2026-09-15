package apiserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var errOAuthRecord = errors.New("invalid or expired OAuth credential")

func oauthRandom() string { return rand.Text() }
func oauthHash(value string) string {
	hash := sha256.Sum256([]byte(value))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}
func oauthKey(kind, value string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: kind + "#" + oauthHash(value)}}
}

// Conditional writes make codes single-use and refresh rotation atomic across
// Lambda instances. Expiry is enforced here; DynamoDB TTL is only cleanup.
func (s *Server) oauthPut(ctx context.Context, kind, key string, value any, expires time.Time, previous string) error {
	if s.oauthTableName == "" {
		return errors.New("OAuth storage unavailable")
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	item := oauthKey(kind, key)
	item["data"] = &types.AttributeValueMemberS{Value: string(data)}
	if !expires.IsZero() {
		item["expires"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(expires.Unix(), 10)}
	}
	input := &dynamodb.PutItemInput{TableName: aws.String(s.oauthTableName), Item: item, ConditionExpression: aws.String("attribute_not_exists(id)")}
	if previous != "" {
		input.ConditionExpression = aws.String("#data = :previous")
		input.ExpressionAttributeNames = map[string]string{"#data": "data"}
		input.ExpressionAttributeValues = map[string]types.AttributeValue{":previous": &types.AttributeValueMemberS{Value: previous}}
	}
	_, err = s.ddb.PutItem(ctx, input)
	return err
}
func (s *Server) oauthGet(ctx context.Context, kind, key string, value any) (string, error) {
	if s.oauthTableName == "" {
		return "", errOAuthRecord
	}
	out, err := s.ddb.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.oauthTableName), Key: oauthKey(kind, key), ConsistentRead: aws.Bool(true)})
	if err != nil {
		return "", err
	}
	if expires, ok := out.Item["expires"].(*types.AttributeValueMemberN); ok {
		n, e := strconv.ParseInt(expires.Value, 10, 64)
		if e != nil || n <= time.Now().Unix() {
			return "", errOAuthRecord
		}
	}
	data, ok := out.Item["data"].(*types.AttributeValueMemberS)
	if !ok {
		return "", errOAuthRecord
	}
	return data.Value, json.Unmarshal([]byte(data.Value), value)
}
func (s *Server) oauthDelete(ctx context.Context, kind, key, previous string) error {
	input := &dynamodb.DeleteItemInput{TableName: aws.String(s.oauthTableName), Key: oauthKey(kind, key)}
	if previous != "" {
		input.ConditionExpression = aws.String("#data = :previous")
		input.ExpressionAttributeNames = map[string]string{"#data": "data"}
		input.ExpressionAttributeValues = map[string]types.AttributeValue{":previous": &types.AttributeValueMemberS{Value: previous}}
	}
	_, err := s.ddb.DeleteItem(ctx, input)
	return err
}
