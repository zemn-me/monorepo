package main

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
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
	// Check for an optional endpoint override.
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	var cfg aws.Config
	var err error
	if endpoint != "" {
		cfg, err = config.LoadDefaultConfig(ctx,
			config.WithEndpointResolver(aws.EndpointResolverFunc(
				func(service, region string) (aws.Endpoint, error) {
					if service == dynamodb.ServiceID {
						return aws.Endpoint{
							URL: endpoint,
						}, nil
					}
					return aws.Endpoint{}, &aws.EndpointNotFoundError{}
				},
			)),
		)
	} else {
		cfg, err = config.LoadDefaultConfig(ctx)
	}
	if err != nil {
		return nil, err
	}

	// Allow the table name to be set via an environment variable.
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")

	return &Server{
		ddb:       dynamodb.NewFromConfig(cfg),
		tableName: tableName,
	}, nil
}
