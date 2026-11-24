package lambdaimage

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-lambda-go/lambdacontext"
)

func TestMain(m *testing.M) {
	if os.Getenv("LAMBDA_IMAGE_TEST_PROCESS") == "1" {
		lambda.Start(func(ctx context.Context, payload string) error {
			call, ok := lambdacontext.FromContext(ctx)
			if !ok || call.AwsRequestID != "request-id" || call.InvokedFunctionArn != "function:$LATEST" {
				return errors.New("missing invocation context")
			}
			if payload != os.Getenv("DEPLOYED_SETTING") {
				return errors.New("unexpected payload")
			}
			return nil
		})
		return
	}
	os.Exit(m.Run())
}

func TestBinaryInvocation(t *testing.T) {
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	fn := Function{ARN: "function", Binary: binary, Timeout: 10, Environment: map[string]string{"DEPLOYED_SETTING": "expected"}}
	event := invocation{RequestPayload: json.RawMessage(`"expected"`)}
	event.RequestContext.RequestID = "request-id"
	event.RequestContext.FunctionARN = fn.ARN + ":$LATEST"
	env := []string{"LAMBDA_IMAGE_TEST_PROCESS=1"}
	if err := fn.invoke(t.Context(), event, env); err != nil {
		t.Fatal(err)
	}
	event.RequestPayload = json.RawMessage(`"unexpected"`)
	if err := fn.invoke(t.Context(), event, env); err == nil || !strings.Contains(err.Error(), "unexpected payload") {
		t.Fatalf("expected the binary's handler error, got %v", err)
	}
	event.RequestContext.FunctionARN = "other-function"
	if err := fn.invoke(t.Context(), event, env); err == nil || !strings.Contains(err.Error(), "invalid invocation") {
		t.Fatalf("accepted another function's invocation: %v", err)
	}
}
