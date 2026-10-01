package main

import (
	"context"
	"os"

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
	app := &server.Server{
		Store:  server.DynamoStore{Client: dynamodb.NewFromConfig(cfg), Table: required("TABLE_NAME")},
		Files:  server.S3Files{Client: s3.NewFromConfig(cfg), Bucket: required("PDF_BUCKET")},
		Mail:   server.SESMailer{Client: sesv2.NewFromConfig(cfg), From: required("MAIL_FROM")},
		Origin: required("SITE_ORIGIN"), Author: required("AUTHOR_EMAIL"),
	}
	lambda.Start(httpadapter.NewV2(app.Handler()).ProxyWithContext)
}
