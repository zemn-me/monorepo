// Package lambdaimage runs Bazel image entrypoints for AWS Emulator integration tests.
package lambdaimage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// Function is the executable and deployment configuration of one image Lambda.
type Function struct {
	Binary, ARN, Name, QueueURL string
	Tools                       []string
	Timeout, MemorySize         int32
	Environment                 map[string]string
}

type invocation struct {
	RequestContext struct{ RequestID, FunctionARN string }
	RequestPayload json.RawMessage
}

// Consume serially delivers Lambda's asynchronous destination records to the
// image entrypoint. A failed invocation leaves its SQS message available for retry.
func (f Function) Consume(ctx context.Context, cfg aws.Config, extraEnv []string) error {
	if f.Binary == "" || f.ARN == "" || f.QueueURL == "" || f.Timeout <= 0 {
		return errors.New("incomplete image Lambda deployment")
	}
	if _, err := os.Stat(f.Binary); err != nil {
		return err
	}
	queue := sqs.NewFromConfig(cfg)
	for {
		batch, err := queue.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl: &f.QueueURL, WaitTimeSeconds: 10, VisibilityTimeout: f.Timeout + 10,
		})
		if err != nil {
			return err
		}
		for _, msg := range batch.Messages {
			var event invocation
			if err := json.Unmarshal([]byte(aws.ToString(msg.Body)), &event); err != nil {
				return err
			}
			if err := f.invoke(ctx, event, extraEnv); err != nil {
				return fmt.Errorf("%s invocation %s: %w", f.ARN, event.RequestContext.RequestID, err)
			}
			if _, err := queue.DeleteMessage(ctx, &sqs.DeleteMessageInput{QueueUrl: &f.QueueURL, ReceiptHandle: msg.ReceiptHandle}); err != nil {
				return err
			}
		}
	}
}

func (f Function) invoke(parent context.Context, event invocation, extraEnv []string) error {
	id := event.RequestContext.RequestID
	if id == "" || strings.Contains(id, "/") || strings.TrimSuffix(event.RequestContext.FunctionARN, ":$LATEST") != f.ARN || len(event.RequestPayload) == 0 {
		return errors.New("invalid invocation record for deployed function")
	}
	ctx, cancel := context.WithTimeout(parent, time.Duration(f.Timeout)*time.Second)
	defer cancel()
	deadline, _ := ctx.Deadline()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	// Each invocation owns one cold runtime. A subsequent poll blocks until
	// teardown, so an event can only be returned to the entrypoint once.
	const prefix = "/2018-06-01/runtime/invocation/"
	result := make(chan error, 1)
	var delivered atomic.Bool
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+prefix+"next", func(w http.ResponseWriter, r *http.Request) {
		if !delivered.CompareAndSwap(false, true) {
			<-r.Context().Done()
			return
		}
		w.Header().Set("Lambda-Runtime-Aws-Request-Id", id)
		w.Header().Set("Lambda-Runtime-Invoked-Function-Arn", event.RequestContext.FunctionARN)
		w.Header().Set("Lambda-Runtime-Deadline-Ms", strconv.FormatInt(deadline.UnixMilli(), 10))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(event.RequestPayload)
	})
	mux.HandleFunc("POST /2018-06-01/runtime/{path...}", func(w http.ResponseWriter, r *http.Request) {
		var err error
		switch r.PathValue("path") {
		case "invocation/" + id + "/response":
			_, err = io.Copy(io.Discard, r.Body)
		case "invocation/" + id + "/error", "init/error":
			body, _ := io.ReadAll(io.LimitReader(r.Body, 4096))
			err = fmt.Errorf("Lambda runtime reported %s: %s", r.PathValue("path"), body)
		default:
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusAccepted)
		select {
		case result <- err:
		case <-ctx.Done():
		}
	})
	server := &http.Server{Handler: mux}
	defer server.Close()
	go server.Serve(listener)

	cmd := exec.CommandContext(ctx, f.Binary)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	for name, value := range f.Environment {
		cmd.Env = append(cmd.Env, name+"="+value)
	}
	var dirs []string
	for _, tool := range f.Tools {
		dirs = append(dirs, filepath.Dir(tool))
	}
	cmd.Env = append(cmd.Env,
		"PATH="+strings.Join(dirs, string(os.PathListSeparator)),
		"AWS_LAMBDA_RUNTIME_API="+listener.Addr().String(),
		"AWS_LAMBDA_FUNCTION_NAME="+f.Name,
		"AWS_LAMBDA_FUNCTION_VERSION=$LATEST",
		"AWS_LAMBDA_FUNCTION_MEMORY_SIZE="+strconv.Itoa(int(f.MemorySize)),
	)
	cmd.Env = append(cmd.Env, extraEnv...)
	if err := cmd.Start(); err != nil {
		return err
	}
	exited := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(exited)
	}()
	select {
	case err = <-result:
	case <-ctx.Done():
		err = ctx.Err()
	case <-exited:
		// A single-invocation runtime can exit after posting its response.
		select {
		case err := <-result:
			return err
		default:
			return fmt.Errorf("entrypoint exited with status %d before reporting its result", cmd.ProcessState.ExitCode())
		}
	}
	cancel()
	<-exited
	return err
}
