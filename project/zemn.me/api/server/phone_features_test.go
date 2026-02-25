package apiserver

import (
	"context"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/beevik/etree"
	"github.com/twilio/twilio-go/twiml"
)

func newTestServer() *Server {
	return &Server{
		log:                  log.New(io.Discard, "", 0),
		twilioSharedSecret:   "secret",
		settingsTableName:    "settings",
		grievancesTableName:  "grievances",
		usersTableName:       "users",
		keyRequestsTableName: "keys",
		ddb:                  &inMemoryDDB{},
		sendText:             func(_ context.Context, _, _, _ string) error { return nil },
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

func TestHandleEntryViaCodeWithKeyRequest(t *testing.T) {
	s := newTestServer()
	if err := s.recordKeyRequest(context.Background(), "thomas"); err != nil {
		t.Fatalf("record key request: %v", err)
	}

	digits := "00000"
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

	doc := etree.NewDocument()
	if err := doc.ReadFromString(xmlData); err != nil {
		t.Fatalf("failed to parse xml: %v", err)
	}
	dial := doc.FindElement("Response/Dial")
	if dial == nil {
		t.Fatalf("expected dial element in parsed xml")
	}
	action := dial.SelectAttrValue("action", "")
	if action == "" {
		t.Fatalf("expected dial action attribute to be set")
	}
	parsedAction, err := url.Parse(action)
	if err != nil {
		t.Fatalf("failed to parse dial action url: %v", err)
	}
	if parsedAction.Path != "/phone/handleEntry" {
		t.Errorf("unexpected dial action path: %q", parsedAction.Path)
	}
	if got := parsedAction.Query().Get("attempt"); got != "2" {
		t.Errorf("unexpected attempt query value: %q", got)
	}
	if got := parsedAction.Query().Get("secret"); got != "" {
		t.Errorf("unexpected secret query value: %q", got)
	}
	if got := dial.SelectAttrValue("method", ""); got != http.MethodGet {
		t.Errorf("unexpected dial method attribute: %q", got)
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

func TestHandleEntryViaAuthorizerRetriesOnNoAnswer(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), CallboxSettings{
		Authorizers: []Authorizer{{PhoneNumber: "+15551234567"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	attempt := 2
	status := "no-answer"
	rs, err := s.handleEntryViaAuthorizer(context.Background(), GetPhoneHandleEntryRequestObject{
		Params: GetPhoneHandleEntryParams{
			Secret:         "sekrit",
			Attempt:        &attempt,
			DialCallStatus: &status,
		},
	})
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

	doc := etree.NewDocument()
	if err := doc.ReadFromString(xmlData); err != nil {
		t.Fatalf("failed to parse xml: %v", err)
	}
	dial := doc.FindElement("Response/Dial")
	if dial == nil {
		t.Fatalf("expected dial element for retry attempt")
	}
	if got := dial.SelectAttrValue("action", ""); got != "" {
		t.Errorf("expected no action on final attempt, got %q", got)
	}
	if dial.SelectAttrValue("method", "") != "" {
		t.Errorf("expected no method attribute on final attempt")
	}
}

func TestHandleEntryViaPartyModeSendsText(t *testing.T) {
	s := newTestServer()
	party := true
	if err := s.postNewSettings(context.Background(), CallboxSettings{
		PartyMode:     &party,
		FallbackPhone: "+15550001111",
	}); err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	t.Setenv("CALLBOX_PHONE_NUMBER", "+15559998888")

	var gotTo, gotFrom, gotBody string
	s.sendText = func(_ context.Context, to, from, body string) error {
		gotTo = to
		gotFrom = from
		gotBody = body
		return nil
	}

	rs, err := s.handleEntryViaPartyMode(context.Background(), PostPhoneInitRequestObject{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rs == nil {
		t.Fatalf("expected twiml response")
	}
	if gotTo != "+15550001111" {
		t.Fatalf("unexpected to number: %q", gotTo)
	}
	if gotFrom != "+15559998888" {
		t.Fatalf("unexpected from number: %q", gotFrom)
	}
	if gotBody != "Callbox party mode entry." {
		t.Fatalf("unexpected body: %q", gotBody)
	}
}

func TestHandleEntryViaAuthorizerSkipsRedialOnCompletedCall(t *testing.T) {
	s := newTestServer()
	err := s.postNewSettings(context.Background(), CallboxSettings{
		Authorizers: []Authorizer{{PhoneNumber: "+15551234567"}},
	})
	if err != nil {
		t.Fatalf("failed to seed settings: %v", err)
	}

	attempt := 2
	status := "completed"
	rs, err := s.handleEntryViaAuthorizer(context.Background(), GetPhoneHandleEntryRequestObject{
		Params: GetPhoneHandleEntryParams{
			Secret:         "sekrit",
			Attempt:        &attempt,
			DialCallStatus: &status,
		},
	})
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

	doc := etree.NewDocument()
	if err := doc.ReadFromString(xmlData); err != nil {
		t.Fatalf("failed to parse xml: %v", err)
	}
	if dial := doc.FindElement("Response/Dial"); dial != nil {
		t.Fatalf("did not expect retry dial when call completed")
	}
}
