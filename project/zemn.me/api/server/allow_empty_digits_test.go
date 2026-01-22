package apiserver

import (
	"context"
	"testing"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

// TestHandleEntryViaCodeEmptyDigits ensures the server does not error when the
// Digits parameter is provided but empty.
func TestHandleEntryViaCodeEmptyDigits(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), api_types.CallboxSettings{
		EntryCodes: []api_types.EntryCodeEntry{{Code: "12345"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	empty := ""
	rq := api_types.GetPhoneHandleEntryRequestObject{
		Params: api_types.GetPhoneHandleEntryParams{Digits: &empty},
	}

	rs, err := s.handleEntryViaCode(context.Background(), rq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rs != nil {
		t.Errorf("expected nil response for empty digits, got %T", rs)
	}
}
