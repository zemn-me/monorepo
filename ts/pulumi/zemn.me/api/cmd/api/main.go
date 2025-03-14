// server for api.zemn.me
package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func main() {
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

	r.Get("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Post("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Get("/phone/handleEntry", TwilioErrorHandler(TwilioCallboxProcessPhoneEntry))

	server, err := NewServer(
		context.Background(),
	)
	if err != nil {
		panic(err)
	}

	h := HandlerFromMux(server, r)

	lambda.Start(httpadapter.New(h).ProxyWithContext)
}
