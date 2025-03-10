// server for api.zemn.me
package main

import (
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

var r = chi.NewRouter()

func init() {
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300, // Cache preflight response for 5 minutes
	}))

	r.Get("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Post("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Get("/phone/handleEntry", TwilioErrorHandler(TwilioCallboxProcessPhoneEntry))
	r.Post("/phone/handleEntry", TwilioErrorHandler(TwilioCallboxProcessPhoneEntry))
	r.Get("/phone/number", CallboxNumberHandler)
 	r.Post("/phone/number", CallboxNumberHandler)
}

func main() {
	lambda.Start(httpadapter.New(r).ProxyWithContext)
}
