// Lambda worker for private journal audio uploaded directly to S3.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

type journalEventProcessor interface {
	ProcessUpload(context.Context, string, string, int64) error
	RefreshSummaries(context.Context, time.Time) error
}

func handleEvent(ctx context.Context, worker journalEventProcessor, event json.RawMessage) error {
	var envelope struct {
		Records []json.RawMessage `json:"Records"`
		Source  string            `json:"source"`
		Time    time.Time         `json:"time"`
	}
	if err := json.Unmarshal(event, &envelope); err != nil {
		return err
	}
	if len(envelope.Records) > 0 {
		var upload events.S3Event
		if err := json.Unmarshal(event, &upload); err != nil {
			return err
		}
		for _, record := range upload.Records {
			key, err := url.QueryUnescape(record.S3.Object.Key)
			if err != nil {
				return err
			}
			if err := worker.ProcessUpload(ctx, record.S3.Bucket.Name, key, record.S3.Object.Size); err != nil {
				return err
			}
		}
		return nil
	}
	if envelope.Source == "aws.events" && !envelope.Time.IsZero() {
		return worker.RefreshSummaries(ctx, envelope.Time)
	}
	return errors.New("unsupported journal worker event")
}

func main() {
	worker, err := apiserver.NewJournalWorker(context.Background())
	if err != nil {
		panic(err)
	}
	lambda.Start(func(ctx context.Context, event json.RawMessage) error {
		return handleEvent(ctx, worker, event)
	})
}
