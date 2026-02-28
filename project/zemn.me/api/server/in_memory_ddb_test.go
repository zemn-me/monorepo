package apiserver

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type inMemoryDDB struct {
	records    []SettingsRecord
	grievances map[string]grievanceRecord
	users      map[string]userRecord
	keyRecords []KeyRequestRecord
}

func (db inMemoryDDB) CreateTable(ctx context.Context, params *dynamodb.CreateTableInput, optFns ...func(*dynamodb.Options)) (*dynamodb.CreateTableOutput, error) {
	// In-memory DDB does not need to create tables.
	return &dynamodb.CreateTableOutput{}, nil
}

func (db *inMemoryDDB) DescribeTable(ctx context.Context, params *dynamodb.DescribeTableInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error) {
	// In-memory DDB does not need to describe tables.
	return &dynamodb.DescribeTableOutput{
		Table: &types.TableDescription{
			TableName: params.TableName,
			KeySchema: []types.KeySchemaElement{
				{AttributeName: aws.String("id"), KeyType: types.KeyTypeHash},
			},
			AttributeDefinitions: []types.AttributeDefinition{
				{AttributeName: aws.String("id"), AttributeType: types.ScalarAttributeTypeS},
			},
			TableStatus: types.TableStatusActive,
		},
	}, nil
}

func (db *inMemoryDDB) Query(ctx context.Context, in *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	if in.TableName != nil && *in.TableName == "keys" {
		if len(db.keyRecords) == 0 {
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
		}
		id := ""
		if v, ok := in.ExpressionAttributeValues[":id"]; ok {
			if s, ok := v.(*types.AttributeValueMemberS); ok {
				id = s.Value
			}
		}
		for i := len(db.keyRecords) - 1; i >= 0; i-- {
			rec := db.keyRecords[i]
			if id != "" && rec.Id != id {
				continue
			}
			item, err := attributevalue.MarshalMap(rec)
			if err != nil {
				return nil, err
			}
			return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
		}
		return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
	}
	if len(db.records) == 0 {
		return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
	}
	item, err := attributevalue.MarshalMap(db.records[len(db.records)-1])
	if err != nil {
		return nil, err
	}
	return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
}

func (db *inMemoryDDB) PutItem(ctx context.Context, in *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	if in.TableName != nil && *in.TableName == "keys" {
		var rec KeyRequestRecord
		if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
			return nil, err
		}
		db.keyRecords = append(db.keyRecords, rec)
		return &dynamodb.PutItemOutput{}, nil
	}
	if in.TableName != nil && *in.TableName == "grievances" {
		var rec grievanceRecord
		if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
			return nil, err
		}
		if db.grievances == nil {
			db.grievances = map[string]grievanceRecord{}
		}
		db.grievances[rec.Id] = rec
		return &dynamodb.PutItemOutput{}, nil
	}
	if in.TableName != nil && *in.TableName == "users" {
		var rec userRecord
		if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
			return nil, err
		}
		if db.users == nil {
			db.users = map[string]userRecord{}
		}
		db.users[rec.Id] = rec
		return &dynamodb.PutItemOutput{}, nil
	}
	var rec SettingsRecord
	if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
		return nil, err
	}
	db.records = append(db.records, rec)
	return &dynamodb.PutItemOutput{}, nil
}

func (db *inMemoryDDB) GetItem(ctx context.Context, in *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
	if in.TableName != nil && *in.TableName == "grievances" {
		if db.grievances == nil {
			return &dynamodb.GetItemOutput{}, nil
		}
		id := in.Key["id"].(*types.AttributeValueMemberS).Value
		rec, ok := db.grievances[id]
		if !ok {
			return &dynamodb.GetItemOutput{}, nil
		}
		item, err := attributevalue.MarshalMap(rec)
		if err != nil {
			return nil, err
		}
		return &dynamodb.GetItemOutput{Item: item}, nil
	}
	if in.TableName != nil && *in.TableName == "users" {
		if db.users == nil {
			return &dynamodb.GetItemOutput{}, nil
		}
		id := in.Key["id"].(*types.AttributeValueMemberS).Value
		rec, ok := db.users[id]
		if !ok {
			return &dynamodb.GetItemOutput{}, nil
		}
		item, err := attributevalue.MarshalMap(rec)
		if err != nil {
			return nil, err
		}
		return &dynamodb.GetItemOutput{Item: item}, nil
	}
	return &dynamodb.GetItemOutput{}, nil
}

func (db *inMemoryDDB) DeleteItem(ctx context.Context, in *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
	if in.TableName != nil && *in.TableName == "grievances" {
		if db.grievances != nil {
			id := in.Key["id"].(*types.AttributeValueMemberS).Value
			delete(db.grievances, id)
		}
		return &dynamodb.DeleteItemOutput{}, nil
	}
	if in.TableName != nil && *in.TableName == "users" {
		if db.users != nil {
			id := in.Key["id"].(*types.AttributeValueMemberS).Value
			delete(db.users, id)
		}
		return &dynamodb.DeleteItemOutput{}, nil
	}
	return &dynamodb.DeleteItemOutput{}, nil
}

func (db *inMemoryDDB) Scan(ctx context.Context, in *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error) {
	if in.TableName != nil && *in.TableName == "grievances" {
		var items []map[string]types.AttributeValue
		for _, rec := range db.grievances {
			item, err := attributevalue.MarshalMap(rec)
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		return &dynamodb.ScanOutput{Items: items}, nil
	}
	if in.TableName != nil && *in.TableName == "users" {
		var items []map[string]types.AttributeValue
		for _, rec := range db.users {
			item, err := attributevalue.MarshalMap(rec)
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		return &dynamodb.ScanOutput{Items: items}, nil
	}
	return &dynamodb.ScanOutput{}, nil
}
