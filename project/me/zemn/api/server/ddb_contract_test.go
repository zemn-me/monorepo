package apiserver

import (
	"context"
	"io"
	"log"
	"reflect"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/me/zemn/api/itestconfig"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type contractRecord struct {
	ID    string `dynamodbav:"id"`
	When  string `dynamodbav:"when"`
	Value string `dynamodbav:"value"`
}

// Run identical persistence scenarios against the fake and emulated DynamoDB.
// The integration target owns an isolated service, port, and database;
// each scenario also uses a separate partition, independent of other records.
func TestDynamoDBContract(t *testing.T) {
	t.Run("in_memory", func(t *testing.T) { checkDynamoDBContract(t, &inMemoryDDB{}, "keys") })
	t.Run("aws_emulator", func(t *testing.T) {
		deployment, err := itestconfig.Load(t.Context())
		if err != nil {
			t.Fatal(err)
		}
		checkDynamoDBContract(t, dynamodb.NewFromConfig(deployment.AWS), deployment.Environment["CALLBOX_KEY_TABLE_NAME"])
	})
}

func checkDynamoDBContract(t *testing.T, db DynamoDBClient, table string) {
	t.Helper()
	t.Run("callbox_closes_after_opening", func(t *testing.T) {
		server := Server{ddb: db, keyRequestsTableName: table, log: log.New(io.Discard, "", 0)}
		ctx := context.WithValue(t.Context(), auth.IDTokenKey, &auth.IDToken{Subject: "contract-user"})
		openRequest := PostCallboxJSONRequestBody{Open: true}
		if _, err := server.PostCallbox(ctx, PostCallboxRequestObject{Body: &openRequest}); err != nil {
			t.Fatal(err)
		}
		response, err := server.GetCallbox(ctx, GetCallboxRequestObject{})
		if err != nil {
			t.Fatal(err)
		}
		opened, ok := response.(GetCallbox200JSONResponse)
		if !ok || !opened.Open {
			t.Fatalf("opening callbox returned %#v", response)
		}

		closeRequest := PostCallboxJSONRequestBody{Open: false}
		if _, err := server.PostCallbox(ctx, PostCallboxRequestObject{Body: &closeRequest}); err != nil {
			t.Fatal(err)
		}
		response, err = server.GetCallbox(ctx, GetCallboxRequestObject{})
		if err != nil {
			t.Fatal(err)
		}
		closed, ok := response.(GetCallbox200JSONResponse)
		if !ok || closed.Open || closed.OpenUntil != nil {
			t.Fatalf("closing callbox returned %#v", response)
		}
	})

	t.Run("put_replaces_the_same_primary_key", func(t *testing.T) {
		id := uuid.NewString()
		putContractRecord(t, db, table, contractRecord{id, "2026-10-01", "original"})
		putContractRecord(t, db, table, contractRecord{id, "2026-10-01", "updated"})

		records, _ := queryContractRecords(t, db, table, id, dynamodb.QueryInput{})
		want := []contractRecord{{id, "2026-10-01", "updated"}}
		if !reflect.DeepEqual(records, want) {
			t.Fatalf("stored records = %#v; want %#v", records, want)
		}
	})
	t.Run("query_defaults_to_ascending_sort_key", func(t *testing.T) {
		id := uuid.NewString()
		putContractRecord(t, db, table, contractRecord{id, "2026-10-02", "second"})
		putContractRecord(t, db, table, contractRecord{id, "2026-10-01", "first"})
		putContractRecord(t, db, table, contractRecord{id + "-other", "2026-10-01", "another partition"})

		records, _ := queryContractRecords(t, db, table, id, dynamodb.QueryInput{})
		want := []contractRecord{{id, "2026-10-01", "first"}, {id, "2026-10-02", "second"}}
		if !reflect.DeepEqual(records, want) {
			t.Fatalf("ordered records = %#v; want %#v", records, want)
		}
	})
	t.Run("descending_query_continues_after_its_cursor", func(t *testing.T) {
		id := uuid.NewString()
		putContractRecord(t, db, table, contractRecord{id, "2026-10-01", "first"})
		putContractRecord(t, db, table, contractRecord{id, "2026-10-02", "second"})

		first, cursor := queryContractRecords(t, db, table, id, dynamodb.QueryInput{ScanIndexForward: aws.Bool(false), Limit: aws.Int32(1)})
		if !reflect.DeepEqual(first, []contractRecord{{id, "2026-10-02", "second"}}) || len(cursor) == 0 {
			t.Fatalf("first page = %#v, cursor = %#v", first, cursor)
		}
		second, cursor := queryContractRecords(t, db, table, id, dynamodb.QueryInput{ScanIndexForward: aws.Bool(false), Limit: aws.Int32(1), ExclusiveStartKey: cursor})
		if !reflect.DeepEqual(second, []contractRecord{{id, "2026-10-01", "first"}}) {
			t.Fatalf("second page = %#v, cursor = %#v", second, cursor)
		}
	})
}

func putContractRecord(t *testing.T, db DynamoDBClient, table string, record contractRecord) {
	t.Helper()
	item, err := attributevalue.MarshalMap(record)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.PutItem(t.Context(), &dynamodb.PutItemInput{TableName: &table, Item: item}); err != nil {
		t.Fatal(err)
	}
}

func queryContractRecords(t *testing.T, db DynamoDBClient, table, id string, input dynamodb.QueryInput) ([]contractRecord, map[string]types.AttributeValue) {
	t.Helper()
	input.TableName = &table
	input.KeyConditionExpression = aws.String("id = :id")
	input.ExpressionAttributeValues = map[string]types.AttributeValue{":id": &types.AttributeValueMemberS{Value: id}}
	input.ConsistentRead = aws.Bool(true)
	result, err := db.Query(t.Context(), &input)
	if err != nil {
		t.Fatalf("query partition %s: %v", id, err)
	}
	var records []contractRecord
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &records); err != nil {
		t.Fatal(err)
	}
	return records, result.LastEvaluatedKey
}
