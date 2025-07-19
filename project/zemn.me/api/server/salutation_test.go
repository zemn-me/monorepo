package apiserver

import (
	"testing"
	"time"
)

func TestSalutationWelcome(t *testing.T) {
	loc, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatalf("failed to load location: %v", err)
	}

	s, err := Salutation(time.Date(2023, 1, 1, 22, 0, 0, 0, loc))
	if err != nil {
		t.Fatalf("Salutation returned error: %v", err)
	}
	if s != "Welcome. " {
		t.Fatalf("expected 'Welcome. ', got %q", s)
	}
}
