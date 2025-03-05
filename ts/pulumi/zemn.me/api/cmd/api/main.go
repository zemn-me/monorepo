// server for api.zemn.me
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/go-chi/chi/v5"
)

func main() {
	if phoneNumber == "" {
		panic("missing phone number")
	}

	r := chi.NewRouter()

	r.Get("/phone/number", CallboxNumberHandler)

	lambda.Start(httpadapter.New(r).ProxyWithContext)
}
