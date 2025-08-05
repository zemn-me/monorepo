package apiserver

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/twilio/twilio-go"

	apiSpec "github.com/zemn-me/monorepo/project/zemn.me/api"
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/auth"
)

// DynamoDBClient captures the minimal subset of the DynamoDB API used by the server.
type DynamoDBClient interface {
	Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	GetItem(ctx context.Context, params *dynamodb.GetItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
	Scan(ctx context.Context, params *dynamodb.ScanInput, optFns ...func(*dynamodb.Options)) (*dynamodb.ScanOutput, error)
	DescribeTable(ctx context.Context, params *dynamodb.DescribeTableInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error)
	CreateTable(ctx context.Context, params *dynamodb.CreateTableInput, optFns ...func(*dynamodb.Options)) (*dynamodb.CreateTableOutput, error)
}

// Ensure the real DynamoDB client implements the interface.
var _ DynamoDBClient = (*dynamodb.Client)(nil)

// Server holds the DynamoDB client and table names.
type Server struct {
	ddb                 DynamoDBClient
	settingsTableName   string
	grievancesTableName string
	rt                  *chi.Mux
	http.Handler
	log                *log.Logger
	twilioSharedSecret string
	twilioClient       *twilio.RestClient
	// skips the ID token authentication (for local dev only!!!!)
	skipIdTokenAuth bool
}

type NewServerOptions struct {
	LocalStack bool
	// skips the ID token authentication (for local dev only!!!!)
	SkipIdTokenAuth bool
}

// NewServer initialises the DynamoDB client and HTTP router.
func NewServer(ctx context.Context, opts NewServerOptions) (*Server, error) {
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

	// Optional endpoint override (DynamoDB Local / LocalStack).
	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	var cfg aws.Config
	if endpoint != "" {
		loadOpts := []func(*config.LoadOptions) error{
			config.WithEndpointResolver(aws.EndpointResolverFunc(
				func(service, region string) (aws.Endpoint, error) {
					if service == dynamodb.ServiceID {
						return aws.Endpoint{URL: endpoint}, nil
					}
					return aws.Endpoint{}, &aws.EndpointNotFoundError{}
				})),
		}
		if opts.LocalStack {
			loadOpts = append(loadOpts, config.WithCredentialsProvider(credentials.StaticCredentialsProvider{
				Value: aws.Credentials{AccessKeyID: "LOCALSTACK", SecretAccessKey: "LOCALSTACK"},
			}))
		}
		cfg, err = config.LoadDefaultConfig(ctx, loadOpts...)
	} else {
		cfg, err = config.LoadDefaultConfig(ctx)
	}
	if err != nil {
		return nil, err
	}

	settingsTableName := os.Getenv("DYNAMODB_TABLE_NAME")
	grievancesTableName := os.Getenv("GRIEVANCES_TABLE_NAME")

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions, http.MethodPatch},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300,
	}))
	r.Use(mw)

	authFunc := auth.OIDC
	if opts.SkipIdTokenAuth {
		authFunc = func(context.Context, *openapi3filter.AuthenticationInput) error {
			return nil
		}
	}

	s := &Server{
		log:                 log.New(os.Stderr, "Server ", log.Ldate|log.Ltime|log.Llongfile|log.LUTC),
		ddb:                 dynamodb.NewFromConfig(cfg),
		settingsTableName:   settingsTableName,
		grievancesTableName: grievancesTableName,
		twilioSharedSecret:  os.Getenv("TWILIO_SHARED_SECRET"),
		twilioClient: twilio.NewRestClientWithParams(twilio.ClientParams{
			Username: os.Getenv("TWILIO_API_KEY_SID"),
			Password: os.Getenv("TWILIO_AUTH_TOKEN"),
		}),
		skipIdTokenAuth: authFunc,
	}

	s.Handler = HandlerFromMux(NewStrictHandler(s, nil), r)
	return s, nil
}

// ProvisionTables creates missing tables and waits until they are ACTIVE.
// It mirrors the schemas defined in Pulumi (id/hash key & optional when/range key).
func (s *Server) ProvisionTables(ctx context.Context) error {
	type tableSpec struct {
		Name  string
		Attrs []types.AttributeDefinition
		Keys  []types.KeySchemaElement
	}

	specs := []tableSpec{
		{
			Name: s.settingsTableName,
			Attrs: []types.AttributeDefinition{
				{AttributeName: aws.String("id"), AttributeType: types.ScalarAttributeTypeS},
				{AttributeName: aws.String("when"), AttributeType: types.ScalarAttributeTypeS},
			},
			Keys: []types.KeySchemaElement{
				{AttributeName: aws.String("id"), KeyType: types.KeyTypeHash},
				{AttributeName: aws.String("when"), KeyType: types.KeyTypeRange},
			},
		},
		{
			Name: s.grievancesTableName,
			Attrs: []types.AttributeDefinition{
				{AttributeName: aws.String("id"), AttributeType: types.ScalarAttributeTypeS},
			},
			Keys: []types.KeySchemaElement{
				{AttributeName: aws.String("id"), KeyType: types.KeyTypeHash},
			},
		},
	}

	for _, spec := range specs {
		if spec.Name == "" {
			continue // table disabled via envvar
		}

		// Does the table already exist?
		_, err := s.ddb.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(spec.Name)})
		if err != nil {
			var rnfe *types.ResourceNotFoundException
			if errors.As(err, &rnfe) {
				s.log.Printf("table %q not found – creating", spec.Name)
				_, err := s.ddb.CreateTable(ctx, &dynamodb.CreateTableInput{
					TableName:                 aws.String(spec.Name),
					AttributeDefinitions:      spec.Attrs,
					KeySchema:                 spec.Keys,
					BillingMode:               types.BillingModePayPerRequest,
					DeletionProtectionEnabled: aws.Bool(false),
				})
				if err != nil {
					return err
				}
			} else {
				return err
			}
		}

		waiter := dynamodb.NewTableExistsWaiter(s.ddb)
		if err := waiter.Wait(ctx, &dynamodb.DescribeTableInput{TableName: aws.String(spec.Name)}, 5*time.Minute); err != nil {
			return err
		}
		s.log.Printf("table %q ready", spec.Name)
	}
	return nil
}
