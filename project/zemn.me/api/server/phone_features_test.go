package apiserver

import (
	"context"
	"io"
	"log"
	"strings"
	"testing"

	"github.com/twilio/twilio-go/twiml"
)

func newTestServer() *Server {
	return &Server{
		log:                 log.New(io.Discard, "", 0),
		twilioSharedSecret:  "secret",
		settingsTableName:   "settings",
		grievancesTableName: "grievances",
		ddb:                 &inMemoryDDB{},
	}
}

func TestTwilioError(t *testing.T) {
	doc, err := twilioError(io.EOF)
	if err != nil {
		t.Fatalf("twilioError returned err: %v", err)
	}
	xmlData, err := twiml.ToXML(doc)
	if err != nil {
		t.Fatalf("failed to encode xml: %v", err)
	}
	if !strings.Contains(xmlData, "<Say>") || !strings.Contains(xmlData, "EOF") {
		t.Errorf("unexpected xml: %s", xmlData)
	}
}

func TestHandleEntryViaCode(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), CallboxSettings{
		EntryCodes: []EntryCodeEntry{{Code: "12345"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	digits := "12345"
	rq := GetPhoneHandleEntryRequestObject{
		Params: GetPhoneHandleEntryParams{
			Digits: &digits,
		},
	}

	rs, err := s.handleEntryViaCode(context.Background(), rq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	resp, ok := rs.(TwimlResponse)
	if !ok {
		t.Fatalf("expected TwimlResponse, got %T", rs)
	}

	xmlData, err := twiml.ToXML(resp.Document)
	if err != nil {
		t.Fatalf("failed to encode xml: %v", err)
	}
	if !strings.Contains(xmlData, "<Play") {
		t.Errorf("expected play element, got %s", xmlData)
	}
}

func TestHandleEntryViaAuthorizerDefault(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), CallboxSettings{
		Authorizers: []Authorizer{{PhoneNumber: "+15551234567"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	rs, err := s.handleEntryViaAuthorizer(context.Background(), GetPhoneHandleEntryRequestObject{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	resp, ok := rs.(TwimlResponse)
	if !ok {
		t.Fatalf("expected TwimlResponse, got %T", rs)
	}

	xmlData, err := twiml.ToXML(resp.Document)
	if err != nil {
		t.Fatalf("failed to encode xml: %v", err)
	}

	if !strings.Contains(xmlData, "<Dial") || !strings.Contains(xmlData, "+15551234567") {
		t.Errorf("expected dial element with number, got %s", xmlData)
	}
	if strings.Contains(xmlData, "<Conference") {
		t.Errorf("did not expect conference element, got %s", xmlData)
	}
}

func TestHandleEntryViaAuthorizerSelectedByDigits(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), CallboxSettings{
		Authorizers: []Authorizer{{PhoneNumber: "+15557654321"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	local, _, err := normalizePhoneNumber("+15557654321")
	if err != nil {
		t.Fatalf("failed to normalize phone number: %v", err)
	}

	rq := GetPhoneHandleEntryRequestObject{
		Params: GetPhoneHandleEntryParams{
			Digits: &local,
		},
	}

	rs, err := s.handleEntryViaAuthorizer(context.Background(), rq)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	resp, ok := rs.(TwimlResponse)
	if !ok {
		t.Fatalf("expected TwimlResponse, got %T", rs)
	}

	xmlData, err := twiml.ToXML(resp.Document)
	if err != nil {
		t.Fatalf("failed to encode xml: %v", err)
	}

	if !strings.Contains(xmlData, "+15557654321") {
		t.Errorf("expected dialed number in response, got %s", xmlData)
	}
	if strings.Contains(xmlData, "<Conference") {
		t.Errorf("did not expect conference element, got %s", xmlData)
	}
}
