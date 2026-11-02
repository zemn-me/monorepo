package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
)

// Handler is the Lambda function entry point
func Handler(ctx context.Context) (string, error) {
	return "Hello, World!", nil
}

func main() {
	// Start the Lambda function
	lambda.Start(Handler)
}
