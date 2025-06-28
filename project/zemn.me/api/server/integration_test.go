package apiserver

import (
       "context"
       "io"
       "net/http"
       "net/http/httptest"
       "strings"
       "testing"
)

func TestHealthzEndpoint(t *testing.T) {
	s, err := NewServer(context.Background())
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}
	ts := httptest.NewServer(s)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("failed to call healthz: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}
       body, err := io.ReadAll(resp.Body)
       if err != nil {
               t.Fatalf("failed to read body: %v", err)
       }
       if strings.TrimSpace(string(body)) != "\"OK\"" {
               t.Errorf("unexpected body: %q", body)
       }
}
