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
type Server struct {
        ddb               *dynamodb.Client
        settingsTableName string
       openWindowTableName string
	rt                *chi.Mux
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

       // Allow the table name to be set via environment variables.
       settingsTableName := os.Getenv("DYNAMODB_TABLE_NAME")
       openWindowTableName := os.Getenv("OPEN_WINDOW_TABLE_NAME")

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
               openWindowTableName: openWindowTableName,
		twilioSharedSecret: os.Getenv("TWILIO_SHARED_SECRET"),
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
