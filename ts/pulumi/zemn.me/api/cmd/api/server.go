package main

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// Server holds the DynamoDB client and table name.
type Server struct {
	ddb       *dynamodb.Client
	tableName string
}

// NewServer initialises the DynamoDB client.
func NewServer(ctx context.Context) (*Server, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &Server{
		ddb:       dynamodb.NewFromConfig(cfg),
		tableName: TableName,
	}, nil
}
