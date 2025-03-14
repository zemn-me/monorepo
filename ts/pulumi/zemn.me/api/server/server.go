package apiserver

import (
	"context"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

// Server holds the DynamoDB client and table name.
type Server struct {
	ddb       *dynamodb.Client
	tableName string
	rt        *chi.Mux
	http.Handler
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

	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{
			"GET",
			"POST",
			"PUT",
			"DELETE",
			"OPTIONS",
			"PATCH",
		},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300, // Cache preflight response for 5 minutes
	}))

	s := &Server{
		ddb:       dynamodb.NewFromConfig(cfg),
		tableName: tableName,
	}

	s.Handler = HandlerFromMux(s, r)

	return s, nil
}
