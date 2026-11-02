package main

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

type recordingEventProcessor struct {
	bucket      string
	key         string
	size        int64
	refreshedAt time.Time
	manualID    string
	manualAt    time.Time
}

func (p *recordingEventProcessor) ProcessUpload(_ context.Context, bucket, key string, size int64) error {
	p.bucket, p.key, p.size = bucket, key, size
	return nil
}

func (p *recordingEventProcessor) RefreshSummaries(_ context.Context, now time.Time) error {
	p.refreshedAt = now
	return nil
}

func TestHandleS3Upload(t *testing.T) {
	processor := &recordingEventProcessor{}
	event := json.RawMessage(`{
		"Records": [{
			"eventSource": "aws:s3",
			"s3": {
				"bucket": {"name": "journal"},
				"object": {"key": "entries%2Fentry-id%2Fsource", "size": 42}
			}
		}]
	}`)
	if err := handleEvent(context.Background(), processor, event); err != nil {
		t.Fatal(err)
	}
	if processor.bucket != "journal" || processor.key != "entries/entry-id/source" || processor.size != 42 {
		t.Fatalf("processed upload = %#v", processor)
	}
}

func TestHandleScheduledSummaryRefresh(t *testing.T) {
	processor := &recordingEventProcessor{}
	event := json.RawMessage(`{
		"source": "aws.events",
		"detail-type": "Scheduled Event",
		"time": "2026-08-14T08:05:00Z"
	}`)
	if err := handleEvent(context.Background(), processor, event); err != nil {
		t.Fatal(err)
	}
	if got, want := processor.refreshedAt.Format(time.RFC3339), "2026-08-14T08:05:00Z"; got != want {
		t.Fatalf("summary refresh time = %s, want %s", got, want)
	}
}

func TestHandleRejectsUnknownEvent(t *testing.T) {
	if err := handleEvent(context.Background(), &recordingEventProcessor{}, json.RawMessage(`{"source":"unknown"}`)); err == nil {
		t.Fatal("unknown event was accepted")
	}
}

func (p *recordingEventProcessor) RunCuration(_ context.Context, now time.Time, requestID string) error {
	p.manualID, p.manualAt = requestID, now
	return nil
}

func TestHandleManualCuration(t *testing.T) {
	processor := &recordingEventProcessor{}
	before := time.Now()
	// A caller-supplied time must not become a daily-budget override.
	event := json.RawMessage(`{"source":"journal.manual","requestId":"request-one","time":"2099-01-01T00:00:00Z"}`)
	if err := handleEvent(t.Context(), processor, event); err != nil {
		t.Fatal(err)
	}
	if processor.manualID != "request-one" || processor.manualAt.Before(before) || processor.manualAt.After(time.Now()) || !processor.refreshedAt.IsZero() {
		t.Fatalf("manual dispatch: %#v", processor)
	}
	for _, body := range []string{`{"source":"journal.manual"}`, `{"source":"journal.manual","requestId":"one","Records":[{}]}`} {
		if err := handleEvent(t.Context(), &recordingEventProcessor{}, json.RawMessage(body)); err == nil {
			t.Fatal("invalid manual event accepted")
		}
	}
}
