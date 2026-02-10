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
	logRecords []CallboxLogRecord
	grievances map[string]grievanceRecord
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
				{AttributeName: aws.String("when"), KeyType: types.KeyTypeRange},
			},
			AttributeDefinitions: []types.AttributeDefinition{
				{AttributeName: aws.String("id"), AttributeType: types.ScalarAttributeTypeS},
				{AttributeName: aws.String("when"), AttributeType: types.ScalarAttributeTypeS},
			},
			TableStatus: types.TableStatusActive,
		},
	}, nil
}

func (db *inMemoryDDB) Query(ctx context.Context, in *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	var id string
	if in.ExpressionAttributeValues != nil {
		if av, ok := in.ExpressionAttributeValues[":id"].(*types.AttributeValueMemberS); ok {
			id = av.Value
		}
	}
	var settings []SettingsRecord
	var logs []CallboxLogRecord
	switch id {
	case PartitionKeyValue:
		settings = db.records
	case CallboxLogPartitionKeyValue:
		logs = db.logRecords
	default:
		return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
	}

	var items []map[string]types.AttributeValue
	appendSettings := func(rec SettingsRecord) error {
		item, err := attributevalue.MarshalMap(rec)
		if err != nil {
			return err
		}
		items = append(items, item)
		return nil
	}
	appendLogs := func(rec CallboxLogRecord) error {
		item, err := attributevalue.MarshalMap(rec)
		if err != nil {
			return err
		}
		items = append(items, item)
		return nil
	}

	limit := int32(0)
	if in.Limit != nil {
		limit = *in.Limit
	}
	emit := func(fn func() error) error {
		if limit > 0 && int32(len(items)) >= limit {
			return nil
		}
		return fn()
	}

	if settings != nil {
		if in.ScanIndexForward != nil && !*in.ScanIndexForward {
			for i := len(settings) - 1; i >= 0; i-- {
				if err := emit(func() error { return appendSettings(settings[i]) }); err != nil {
					return nil, err
				}
				if limit > 0 && int32(len(items)) >= limit {
					break
				}
			}
		} else {
			for i := 0; i < len(settings); i++ {
				if err := emit(func() error { return appendSettings(settings[i]) }); err != nil {
					return nil, err
				}
				if limit > 0 && int32(len(items)) >= limit {
					break
				}
			}
		}
	}

	if logs != nil {
		if in.ScanIndexForward != nil && !*in.ScanIndexForward {
			for i := len(logs) - 1; i >= 0; i-- {
				if err := emit(func() error { return appendLogs(logs[i]) }); err != nil {
					return nil, err
				}
				if limit > 0 && int32(len(items)) >= limit {
					break
				}
			}
		} else {
			for i := 0; i < len(logs); i++ {
				if err := emit(func() error { return appendLogs(logs[i]) }); err != nil {
					return nil, err
				}
				if limit > 0 && int32(len(items)) >= limit {
					break
				}
			}
		}
	}

	return &dynamodb.QueryOutput{Items: items}, nil
}

func (db *inMemoryDDB) PutItem(ctx context.Context, in *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
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
	if _, ok := in.Item["kind"]; ok {
		var rec CallboxLogRecord
		if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
			return nil, err
		}
		db.logRecords = append(db.logRecords, rec)
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
	return &dynamodb.ScanOutput{}, nil
}
