package apiserver

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/twilio/twilio-go"

	apiSpec "github.com/zemn-me/monorepo/project/zemn.me/api"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

// Server holds the DynamoDB client and table name.
// DynamoDBClient captures the minimal subset of the DynamoDB API used by the server.
type DynamoDBClient interface {
	Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
	Scan(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error)
}

// Ensure the real DynamoDB client implements the interface.
var _ DynamoDBClient = (*dynamodb.Client)(nil)

// Server holds the DynamoDB client and table name.
type Server struct {
	ddb                 DynamoDBClient
	settingsTableName   string
	grievancesTableName string
	rt                  *chi.Mux
	http.Handler
	log                *log.Logger
	twilioSharedSecret string
	twilioClient       *twilio.RestClient
}

// NewServer initialises the DynamoDB client.
func NewServer(ctx context.Context) (*Server, error) {
	spec, err := openapi3.NewLoader().LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		return nil, err
	}

	spec.Servers = nil

	mw := middleware.OapiRequestValidatorWithOptions(spec, &middleware.Options{
		Options: openapi3filter.Options{
			AuthenticationFunc: auth.OIDC,
		},
	})

	// Check for an optional endpoint override.
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	var cfg aws.Config
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

	// Allow the table names to be set via environment variables.
	settingsTableName := os.Getenv("DYNAMODB_TABLE_NAME")
	grievancesTableName := os.Getenv("GRIEVANCES_TABLE_NAME")

	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
			http.MethodPatch,
		},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300, // Cache preflight response for 5 minutes
	}))

	r.Use(mw)

	s := &Server{
		log: log.New(
			os.Stderr,
			"Server",
			log.Ldate|log.Ltime|log.Llongfile|log.LUTC,
		),
		ddb:                 dynamodb.NewFromConfig(cfg),
		settingsTableName:   settingsTableName,
		grievancesTableName: grievancesTableName,
		twilioSharedSecret:  os.Getenv("TWILIO_SHARED_SECRET"),
		twilioClient: twilio.NewRestClientWithParams(twilio.ClientParams{
			Username: os.Getenv("TWILIO_API_KEY_SID"), // idk
			Password: os.Getenv("TWILIO_AUTH_TOKEN"),
		}),
	}

	s.Handler = HandlerFromMux(NewStrictHandler(
		s,
		nil,
	), r)

	return s, nil
}
