package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

func TestDelayedHealthyService(t *testing.T) {
	var ports map[string]string
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		t.Fatal(err)
	}
	port := ports["@@//bzl/itest/healthcheck:server"]
	if port == "" {
		t.Fatalf("missing fixture port: %v", ports)
	}
	client := http.Client{Timeout: 5 * time.Second}
	response, err := client.Get("http://localhost:" + port + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusOK || string(body) != "OK" {
		t.Fatalf("unexpected readiness response: %d %q", response.StatusCode, body)
	}
}
