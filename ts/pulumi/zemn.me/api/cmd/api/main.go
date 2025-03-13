// server for api.zemn.me
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	lambda.Start(httpadapter.New(h).ProxyWithContext)
}
