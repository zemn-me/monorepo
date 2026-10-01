package server

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddb "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	ses "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type DynamoStore struct {
	Client *dynamodb.Client
	Table  string
}

func key(kind, id string) map[string]ddb.AttributeValue {
	return map[string]ddb.AttributeValue{"kind": &ddb.AttributeValueMemberS{Value: kind}, "id": &ddb.AttributeValueMemberS{Value: id}}
}
func number(n int64) ddb.AttributeValue { return &ddb.AttributeValueMemberN{Value: fmt.Sprint(n)} }
func decodeRecord(m map[string]ddb.AttributeValue) (Record, error) {
	if len(m) == 0 {
		return Record{}, ErrMissing
	}
	var rec Record
	err := attributevalue.UnmarshalMap(m, &rec)
	return rec, err
}
func (s DynamoStore) Get(ctx context.Context, kind, id string) (Record, error) {
	out, err := s.Client.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.Table), Key: key(kind, id), ConsistentRead: aws.Bool(true)})
	if err != nil {
		return Record{}, err
	}
	return decodeRecord(out.Item)
}
func (s DynamoStore) Put(ctx context.Context, kind, id string, rec Record) error {
	rec.Kind = kind
	rec.ID = id
	m, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.Client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.Table), Item: m})
	return err
}
func (s DynamoStore) Take(ctx context.Context, kind, id string, now int64) (Record, error) {
	out, err := s.Client.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(s.Table), Key: key(kind, id), ConditionExpression: aws.String("expires > :now"), ExpressionAttributeValues: map[string]ddb.AttributeValue{":now": number(now)}, ReturnValues: ddb.ReturnValueAllOld})
	var condition *ddb.ConditionalCheckFailedException
	if errors.As(err, &condition) {
		return Record{}, ErrMissing
	}
	if err != nil {
		return Record{}, err
	}
	return decodeRecord(out.Attributes)
}
func (s DynamoStore) Limit(ctx context.Context, id string, now, expires int64, max int) (bool, error) {
	// Expired windows are replaced conditionally; active counters are incremented
	// atomically, so concurrent Lambda invocations share the same limit.
	_, err := s.Client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.Table), Item: map[string]ddb.AttributeValue{"kind": &ddb.AttributeValueMemberS{Value: "limit"}, "id": &ddb.AttributeValueMemberS{Value: id}, "expires": number(expires), "hits": number(1)}, ConditionExpression: aws.String("attribute_not_exists(id) OR expires <= :now"), ExpressionAttributeValues: map[string]ddb.AttributeValue{":now": number(now)}})
	if err == nil {
		return true, nil
	}
	var condition *ddb.ConditionalCheckFailedException
	if !errors.As(err, &condition) {
		return false, err
	}
	_, err = s.Client.UpdateItem(ctx, &dynamodb.UpdateItemInput{TableName: aws.String(s.Table), Key: key("limit", id), UpdateExpression: aws.String("ADD hits :one"), ConditionExpression: aws.String("hits < :max AND expires > :now"), ExpressionAttributeValues: map[string]ddb.AttributeValue{":one": number(1), ":max": number(int64(max)), ":now": number(now)}})
	if errors.As(err, &condition) {
		return false, nil
	}
	return err == nil, err
}
func (s DynamoStore) Issues(ctx context.Context) ([]Record, error) {
	var records []Record
	pages := dynamodb.NewQueryPaginator(s.Client, &dynamodb.QueryInput{TableName: aws.String(s.Table), KeyConditionExpression: aws.String("kind = :kind"), ExpressionAttributeValues: map[string]ddb.AttributeValue{":kind": &ddb.AttributeValueMemberS{Value: "issue"}}, ConsistentRead: aws.Bool(true)})
	for pages.HasMorePages() {
		out, err := pages.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		var part []Record
		if err := attributevalue.UnmarshalListOfMaps(out.Items, &part); err != nil {
			return nil, err
		}
		records = append(records, part...)
	}
	return records, nil
}
func revisionCondition(revision string) (string, map[string]ddb.AttributeValue) {
	if revision == "" {
		return "attribute_not_exists(revision)", nil
	}
	return "revision = :revision", map[string]ddb.AttributeValue{":revision": &ddb.AttributeValueMemberS{Value: revision}}
}
func (s DynamoStore) ReplaceIssue(ctx context.Context, old, next Record) error {
	next.Kind, next.ID = "issue", issueID(next.Number)
	item, err := attributevalue.MarshalMap(next)
	if err != nil {
		return err
	}
	condition, values := revisionCondition(old.Revision)
	_, err = s.Client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.Table), Item: item, ConditionExpression: aws.String(condition), ExpressionAttributeValues: values})
	var conflict *ddb.ConditionalCheckFailedException
	if errors.As(err, &conflict) {
		return ErrConflict
	}
	return err
}
func (s DynamoStore) Publish(ctx context.Context, id string, now int64, rec Record) error {
	condition, values := revisionCondition(rec.Revision)
	rec.Revision = id
	rec.Kind = "issue"
	rec.ID = issueID(rec.Number)
	m, err := attributevalue.MarshalMap(rec)
	if err != nil {
		return err
	}
	_, err = s.Client.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []ddb.TransactWriteItem{
		{Delete: &ddb.Delete{TableName: aws.String(s.Table), Key: key("upload", id), ConditionExpression: aws.String("expires > :now"), ExpressionAttributeValues: map[string]ddb.AttributeValue{":now": number(now)}}},
		{Put: &ddb.Put{TableName: aws.String(s.Table), Item: m, ConditionExpression: aws.String(condition), ExpressionAttributeValues: values}},
	}})
	var canceled *ddb.TransactionCanceledException
	if errors.As(err, &canceled) {
		for _, reason := range canceled.CancellationReasons {
			if aws.ToString(reason.Code) == "ConditionalCheckFailed" {
				return ErrMissing
			}
		}
	}
	return err
}

type S3Files struct {
	Client *s3.Client
	Bucket string
}

func (s S3Files) Prepare(ctx context.Context, key string) (Upload, error) {
	out, err := s3.NewPresignClient(s.Client).PresignPostObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.Bucket), Key: aws.String(key)}, func(o *s3.PresignPostOptions) {
		o.Expires = 15 * time.Minute
		o.Conditions = []any{[]any{"content-length-range", 5, MaxPDFBytes}, map[string]string{"Content-Type": "application/pdf"}}
	})
	if err != nil {
		return Upload{}, err
	}
	out.Values["Content-Type"] = "application/pdf"
	return Upload{URL: out.URL, Fields: out.Values}, nil
}
func (s S3Files) Inspect(ctx context.Context, key string) (Object, error) {
	head, err := s.Client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.Bucket), Key: aws.String(key)})
	if err != nil {
		return Object{}, err
	}
	obj := Object{Version: aws.ToString(head.VersionId), Size: aws.ToInt64(head.ContentLength), ContentType: aws.ToString(head.ContentType)}
	if obj.Version == "" || obj.Version == "null" || obj.Size > MaxPDFBytes {
		return obj, nil
	}
	body, err := s.Client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.Bucket), Key: aws.String(key), VersionId: head.VersionId, Range: aws.String("bytes=0-4")})
	if err != nil {
		return Object{}, err
	}
	defer body.Body.Close()
	obj.Prefix, err = io.ReadAll(io.LimitReader(body.Body, 5))
	return obj, err
}
func (s S3Files) Download(ctx context.Context, rec Record) (string, error) {
	out, err := s3.NewPresignClient(s.Client).PresignGetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.Bucket), Key: aws.String(rec.Key), VersionId: aws.String(rec.Version), ResponseContentType: aws.String("application/pdf"), ResponseContentDisposition: aws.String(fmt.Sprintf(`inline; filename="bowery-bugle-issue-%d.pdf"`, rec.Number))}, func(o *s3.PresignOptions) { o.Expires = 15 * time.Minute })
	if err != nil {
		return "", err
	}
	return out.URL, nil
}

type SESMailer struct {
	Client *sesv2.Client
	From   string
}

func (s SESMailer) Send(ctx context.Context, to string, email LoginEmail) error {
	_, err := s.Client.SendEmail(ctx, &sesv2.SendEmailInput{FromEmailAddress: aws.String(s.From), Destination: &ses.Destination{ToAddresses: []string{to}}, Content: &ses.EmailContent{Simple: &ses.Message{Subject: &ses.Content{Data: aws.String("Log in to The Bowery Bugle")}, Body: &ses.Body{Text: &ses.Content{Data: aws.String(email.body())}}}}})
	return err
}
