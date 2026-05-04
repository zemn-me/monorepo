package apiserver

import (
	"context"
	"testing"
	"time"
)

func TestPostAnalyticsBeaconStoresEvent(t *testing.T) {
	s := newTestServer()

	eventTime := time.Date(2026, time.March, 29, 12, 34, 56, 0, time.UTC)
	body := AnalyticsEvent{
		EventName: "page_view",
		EventTime: eventTime,
		EventId:   "evt-123",
		SessionId: "session-456",
		AnonymousId: func() *string {
			v := "anon-789"
			return &v
		}(),
		Page: &AnalyticsPage{
			UrlPath: func() *string { v := "pricing"; return &v }(),
			Title:   func() *string { v := "Pricing"; return &v }(),
		},
		Context: &AnalyticsContext{
			Locale:   func() *string { v := "en-US"; return &v }(),
			TimeZone: func() *string { v := "America/Los_Angeles"; return &v }(),
		},
	}

	resp, err := s.PostAnalyticsBeacon(context.Background(), PostAnalyticsBeaconRequestObject{
		Body: &body,
	})
	if err != nil {
		t.Fatalf("post analytics beacon: %v", err)
	}

	accepted, ok := resp.(PostAnalyticsBeacon202JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if !accepted.Accepted {
		t.Fatalf("expected accepted response")
	}

	db, ok := s.ddb.(*inMemoryDDB)
	if !ok {
		t.Fatalf("expected in-memory ddb, got %T", s.ddb)
	}
	if len(db.analytics) != 1 {
		t.Fatalf("expected 1 analytics record, got %d", len(db.analytics))
	}

	record := db.analytics[0]
	if record.Id != "session-456" {
		t.Fatalf("unexpected partition key: %#v", record)
	}
	if record.When != "2026-03-29T12:34:56Z#evt-123" {
		t.Fatalf("unexpected sort key: %q", record.When)
	}
	if record.SourceIp != "" {
		t.Fatalf("unexpected source ip without request context: %q", record.SourceIp)
	}
	if record.Origin != "" {
		t.Fatalf("unexpected origin without request context: %q", record.Origin)
	}
	if record.Event.EventName != "page_view" {
		t.Fatalf("unexpected stored event: %#v", record.Event)
	}
	if record.Event.Page == nil || record.Event.Page.UrlPath == nil || *record.Event.Page.UrlPath != "pricing" {
		t.Fatalf("expected page payload, got %#v", record.Event.Page)
	}
	if record.Event.Context == nil || record.Event.Context.TimeZone == nil || *record.Event.Context.TimeZone != "America/Los_Angeles" {
		t.Fatalf("expected stored timezone, got %#v", record.Event.Context)
	}
}

func TestPostAnalyticsBeaconStoresSourceIPFromContext(t *testing.T) {
	s := newTestServer()

	eventTime := time.Date(2026, time.March, 29, 12, 34, 56, 0, time.UTC)
	body := AnalyticsEvent{
		EventName: "page_view",
		EventTime: eventTime,
		EventId:   "evt-123",
		SessionId: "session-456",
	}

	ctx := context.WithValue(context.Background(), analyticsSourceIPContextKey, "203.0.113.7")
	_, err := s.PostAnalyticsBeacon(ctx, PostAnalyticsBeaconRequestObject{
		Body: &body,
	})
	if err != nil {
		t.Fatalf("post analytics beacon: %v", err)
	}

	db, ok := s.ddb.(*inMemoryDDB)
	if !ok {
		t.Fatalf("expected in-memory ddb, got %T", s.ddb)
	}
	if len(db.analytics) != 1 {
		t.Fatalf("expected 1 analytics record, got %d", len(db.analytics))
	}
	if db.analytics[0].SourceIp != "203.0.113.7" {
		t.Fatalf("unexpected source ip: %#v", db.analytics[0])
	}
}

func TestPostAnalyticsBeaconStoresOriginFromContext(t *testing.T) {
	s := newTestServer()

	eventTime := time.Date(2026, time.March, 29, 12, 34, 56, 0, time.UTC)
	body := AnalyticsEvent{
		EventName: "page_view",
		EventTime: eventTime,
		EventId:   "evt-123",
		SessionId: "session-456",
	}

	ctx := context.WithValue(context.Background(), analyticsOriginContextKey, "https://zemn.me")
	_, err := s.PostAnalyticsBeacon(ctx, PostAnalyticsBeaconRequestObject{
		Body: &body,
	})
	if err != nil {
		t.Fatalf("post analytics beacon: %v", err)
	}

	db, ok := s.ddb.(*inMemoryDDB)
	if !ok {
		t.Fatalf("expected in-memory ddb, got %T", s.ddb)
	}
	if len(db.analytics) != 1 {
		t.Fatalf("expected 1 analytics record, got %d", len(db.analytics))
	}
	if db.analytics[0].Origin != "https://zemn.me" {
		t.Fatalf("unexpected origin: %#v", db.analytics[0])
	}
}
