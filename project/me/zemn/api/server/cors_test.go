package apiserver

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func TestCORS(t *testing.T) {
	rc := httptest.NewRecorder()

	s, err := NewServer(t.Context(), NewServerOptions{})
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	rq := httptest.NewRequest(http.MethodOptions, "/healthz", nil)
	rq.Header.Set("Access-Control-Request-Method", http.MethodGet)
	rq.Header.Set("Origin", "http://example.com")
	s.ServeHTTP(rc, rq)

	if rc.Code != http.StatusOK {
		t.Errorf("expected status code %d, got %d", http.StatusOK, rc.Code)
	}

	if rc.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected Access-Control-Allow-Origin header to be '*', got '%s'", rc.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestAnalyticsBeaconCORSAllowsKnownOrigin(t *testing.T) {
	s, err := NewServer(t.Context(), NewServerOptions{})
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	for _, origin := range []string{
		"https://zemn.me",
		"https://lulu.computer",
		"https://baby.computer",
		"https://pleaseintroducemetoyour.dog",
		"https://staging.pleaseintroducemetoyour.dog",
		"https://eggsfordogs.com",
	} {
		rc := httptest.NewRecorder()
		rq := httptest.NewRequest(http.MethodOptions, "/analytics/beacon", nil)
		rq.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rq.Header.Set("Origin", origin)
		s.ServeHTTP(rc, rq)

		if rc.Code != http.StatusOK {
			t.Fatalf("%s: expected status code %d, got %d", origin, http.StatusOK, rc.Code)
		}

		if rc.Header().Get("Access-Control-Allow-Origin") != "*" {
			t.Fatalf("%s: unexpected allow origin header: %q", origin, rc.Header().Get("Access-Control-Allow-Origin"))
		}
	}
}

func TestAnalyticsBeaconCORSRejectsUnknownOrigin(t *testing.T) {
	rc := httptest.NewRecorder()

	s, err := NewServer(t.Context(), NewServerOptions{})
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	rq := httptest.NewRequest(http.MethodOptions, "/analytics/beacon", nil)
	rq.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rq.Header.Set("Origin", "https://evil.example")
	s.ServeHTTP(rc, rq)

	if rc.Code != http.StatusForbidden {
		t.Fatalf("expected status code %d, got %d", http.StatusForbidden, rc.Code)
	}
}

func TestAnalyticsBeaconRejectsUnknownOriginPost(t *testing.T) {
	rc := httptest.NewRecorder()

	s := newTestServer()
	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions, http.MethodPatch},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300,
	}))
	h := analyticsBeaconHandler(HandlerFromMux(NewStrictHandler(s, nil), r))

	rq := httptest.NewRequest(http.MethodPost, "/analytics/beacon", bytes.NewBufferString(`{"eventName":"page_view","eventTime":"2026-03-29T12:34:56Z","eventId":"evt-1","sessionId":"session-1"}`))
	rq.Header.Set("Origin", "https://evil.example")
	rq.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rc, rq)

	if rc.Code != http.StatusForbidden {
		t.Fatalf("expected status code %d, got %d", http.StatusForbidden, rc.Code)
	}
}
