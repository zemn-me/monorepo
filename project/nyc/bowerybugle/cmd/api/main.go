package main

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	kmstypes "github.com/aws/aws-sdk-go-v2/service/kms/types"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/zemn-me/monorepo/project/nyc/bowerybugle/server"
)

func required(name string) string {
	v := os.Getenv(name)
	if v == "" {
		panic("missing " + name)
	}
	return v
}
func main() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		panic(err)
	}
	origin := required("SITE_ORIGIN")
	author := strings.ToLower(strings.TrimSpace(required("AUTHOR_EMAIL")))
	// Derive once per cold start. The persistent master secret stays in KMS;
	// no challenge records or secret values are needed in Lambda configuration.
	seed, err := kms.NewFromConfig(cfg).GenerateMac(context.Background(), &kms.GenerateMacInput{
		KeyId:        aws.String(required("LOGIN_KEY_ID")),
		MacAlgorithm: kmstypes.MacAlgorithmSpecHmacSha256,
		Message:      server.LoginKeyContext(origin, author),
	})
	if err != nil {
		panic(err)
	}
	if len(seed.Mac) != 32 {
		panic("unexpected login seed length")
	}
	app := &server.Server{
		Store:  server.DynamoStore{Client: dynamodb.NewFromConfig(cfg), Table: required("TABLE_NAME")},
		Files:  server.S3Files{Client: s3.NewFromConfig(cfg), Bucket: required("PDF_BUCKET")},
		Mail:   server.SESMailer{Client: sesv2.NewFromConfig(cfg), From: required("MAIL_FROM")},
		Origin: origin, Author: author, LoginKey: seed.Mac,
	}
	lambda.Start(httpadapter.NewV2(app.Handler()).ProxyWithContext)
}
