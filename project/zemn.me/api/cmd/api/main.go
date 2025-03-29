// Lambda HTTP server for api.zemn.me.
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	apiserver "github.com/zemn-me/monorepo/project/zemn.me/api/server"
)

func main() {
	server, err := apiserver.NewServer(
		context.Background(),
	)
	if err != nil {
		panic(err)
	}

	lambda.Start(httpadapter.New(server).ProxyWithContext)
}
