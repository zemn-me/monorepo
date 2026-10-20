package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type contractRecord struct {
	ID    string `dynamodbav:"id"`
	When  string `dynamodbav:"when"`
	Value string `dynamodbav:"value"`
}

// Run identical persistence scenarios against the fake and DynamoDB Local.
// The integration target owns an isolated service, port, and database directory;
// each scenario also uses a separate partition, independent of other records.
func TestDynamoDBContract(t *testing.T) {
	t.Run("in_memory", func(t *testing.T) { checkDynamoDBContract(t, &inMemoryDDB{}) })
	t.Run("dynamodb_local", func(t *testing.T) {
		var ports struct {
			DynamoDB string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
		}
		if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.DynamoDB == "" {
			t.Fatalf("assigned DynamoDB port: %v", err)
		}
		db := dynamodb.NewFromConfig(aws.Config{Region: "us-east-1", Credentials: aws.CredentialsProviderFunc(func(context.Context) (aws.Credentials, error) {
			return aws.Credentials{AccessKeyID: "test", SecretAccessKey: "test"}, nil
		})}, func(options *dynamodb.Options) {
			options.BaseEndpoint = aws.String("http://localhost:" + ports.DynamoDB)
		})
		_, err := db.CreateTable(t.Context(), &dynamodb.CreateTableInput{
			TableName: aws.String("keys"), BillingMode: types.BillingModePayPerRequest,
			AttributeDefinitions: []types.AttributeDefinition{{AttributeName: aws.String("id"), AttributeType: types.ScalarAttributeTypeS}, {AttributeName: aws.String("when"), AttributeType: types.ScalarAttributeTypeS}},
			KeySchema:            []types.KeySchemaElement{{AttributeName: aws.String("id"), KeyType: types.KeyTypeHash}, {AttributeName: aws.String("when"), KeyType: types.KeyTypeRange}},
		})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if _, err := db.DeleteTable(context.Background(), &dynamodb.DeleteTableInput{TableName: aws.String("keys")}); err != nil {
				t.Error(err)
			}
		})
		if err := dynamodb.NewTableExistsWaiter(db).Wait(t.Context(), &dynamodb.DescribeTableInput{TableName: aws.String("keys")}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		checkDynamoDBContract(t, db)
	})
}

func checkDynamoDBContract(t *testing.T, db DynamoDBClient) {
	t.Helper()
	t.Run("callbox_closes_after_opening", func(t *testing.T) {
		server := Server{ddb: db, keyRequestsTableName: "keys", log: log.New(io.Discard, "", 0)}
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
		putContractRecord(t, db, contractRecord{id, "2026-10-01", "original"})
		putContractRecord(t, db, contractRecord{id, "2026-10-01", "updated"})

		records, _ := queryContractRecords(t, db, id, dynamodb.QueryInput{})
		want := []contractRecord{{id, "2026-10-01", "updated"}}
		if !reflect.DeepEqual(records, want) {
			t.Fatalf("stored records = %#v; want %#v", records, want)
		}
	})
	t.Run("query_defaults_to_ascending_sort_key", func(t *testing.T) {
		id := uuid.NewString()
		putContractRecord(t, db, contractRecord{id, "2026-10-02", "second"})
		putContractRecord(t, db, contractRecord{id, "2026-10-01", "first"})
		putContractRecord(t, db, contractRecord{id + "-other", "2026-10-01", "another partition"})

		records, _ := queryContractRecords(t, db, id, dynamodb.QueryInput{})
		want := []contractRecord{{id, "2026-10-01", "first"}, {id, "2026-10-02", "second"}}
		if !reflect.DeepEqual(records, want) {
			t.Fatalf("ordered records = %#v; want %#v", records, want)
		}
	})
	t.Run("descending_query_continues_after_its_cursor", func(t *testing.T) {
		id := uuid.NewString()
		putContractRecord(t, db, contractRecord{id, "2026-10-01", "first"})
		putContractRecord(t, db, contractRecord{id, "2026-10-02", "second"})

		first, cursor := queryContractRecords(t, db, id, dynamodb.QueryInput{ScanIndexForward: aws.Bool(false), Limit: aws.Int32(1)})
		if !reflect.DeepEqual(first, []contractRecord{{id, "2026-10-02", "second"}}) || len(cursor) == 0 {
			t.Fatalf("first page = %#v, cursor = %#v", first, cursor)
		}
		second, cursor := queryContractRecords(t, db, id, dynamodb.QueryInput{ScanIndexForward: aws.Bool(false), Limit: aws.Int32(1), ExclusiveStartKey: cursor})
		if !reflect.DeepEqual(second, []contractRecord{{id, "2026-10-01", "first"}}) {
			t.Fatalf("second page = %#v, cursor = %#v", second, cursor)
		}
	})
}

func putContractRecord(t *testing.T, db DynamoDBClient, record contractRecord) {
	t.Helper()
	item, err := attributevalue.MarshalMap(record)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.PutItem(t.Context(), &dynamodb.PutItemInput{TableName: aws.String("keys"), Item: item}); err != nil {
		t.Fatal(err)
	}
}

func queryContractRecords(t *testing.T, db DynamoDBClient, id string, input dynamodb.QueryInput) ([]contractRecord, map[string]types.AttributeValue) {
	t.Helper()
	input.TableName = aws.String("keys")
	input.KeyConditionExpression = aws.String("id = :id")
	input.ExpressionAttributeValues = map[string]types.AttributeValue{":id": &types.AttributeValueMemberS{Value: id}}
	input.ConsistentRead = aws.Bool(true)
	result, err := db.Query(t.Context(), &input)
	if err != nil {
		t.Fatal(fmt.Errorf("query partition %s: %w", id, err))
	}
	var records []contractRecord
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &records); err != nil {
		t.Fatal(err)
	}
	return records, result.LastEvaluatedKey
}
