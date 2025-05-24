package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	rc := httptest.NewRecorder()

	s, err := NewServer(t.Context())
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}
	s.ServeHTTP(rc, httptest.NewRequest("OPTIONS", "/healthz", nil))

	if rc.Code != http.StatusOK {
		t.Errorf("expected status code %d, got %d", http.StatusOK, rc.Code)
	}

	if rc.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected Access-Control-Allow-Origin header to be '*', got '%s'", rc.Header().Get("Access-Control-Allow-Origin"))
	}

	if rc.Body.String() != `"OK"` {
		t.Errorf("expected body to be 'OK', got '%s'", rc.Body.String())
	}
}
