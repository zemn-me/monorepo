package apiserver

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/twilio/twilio-go/client"
)

// Server holds the DynamoDB client and table name.
type Server struct {
	ddb               *dynamodb.Client
	settingsTableName string
	rt                *chi.Mux
	http.Handler
	log             *log.Logger
	twilioValidator client.RequestValidator
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
	settingsTableName := os.Getenv("DYNAMODB_TABLE_NAME")

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
		log: log.New(
			os.Stderr,
			"Server",
			log.Ldate|log.Ltime|log.Llongfile|log.LUTC,
		),
		ddb:               dynamodb.NewFromConfig(cfg),
		settingsTableName: settingsTableName,
		twilioValidator:   client.NewRequestValidator(os.Getenv("TWILIO_AUTH_TOKEN")),
	}

	s.Handler = HandlerFromMux(s, r)

	return s, nil
}
