package apiserver

import (
	"context"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/beevik/etree"
	"github.com/twilio/twilio-go/twiml"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

func newTestServer() *Server {
	return &Server{
		log:                  log.New(io.Discard, "", 0),
		twilioSharedSecret:   "secret",
		analyticsTableName:   "analytics",
		settingsTableName:    "settings",
		grievancesTableName:  "grievances",
		usersTableName:       "users",
		keyRequestsTableName: "keys",
		ddb:                  &inMemoryDDB{},
		sendText:             func(_ context.Context, _, _, _ string) error { return nil },
		fetchCalendarICal:    func(_ context.Context, _ string) (string, error) { return "", nil },
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
	open, rec, remaining, err := s.currentDoorOpenStatus(context.Background(), doorOpenDuration)
	if err != nil {
		t.Fatalf("door status: %v", err)
	}
	if !open {
		t.Fatalf("expected door to be open")
	}
	if rec == nil || rec.Source != "web_key_request" {
		t.Fatalf("expected web key source, got %+v", rec)
	}
	if rec.Subject != "thomas" {
		t.Fatalf("expected key-request subject recorded")
	}
	if remaining <= 0 || remaining > doorOpenDuration {
		t.Fatalf("unexpected remaining duration: %v", remaining)
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
	open, rec, _, err := s.currentDoorOpenStatus(context.Background(), doorOpenDuration)
	if err != nil {
		t.Fatalf("door status: %v", err)
	}
	if !open {
		t.Fatalf("expected door to be open")
	}
	if rec == nil || rec.Source != "party_mode" {
		t.Fatalf("expected party mode source, got %+v", rec)
	}
}

func TestPostPhoneInitWithKeyRequestSkipsPreamble(t *testing.T) {
	s := newTestServer()
	if err := s.recordKeyRequest(context.Background(), "thomas"); err != nil {
		t.Fatalf("record key request: %v", err)
	}

	rs, err := s.postPhoneInit(context.Background(), PostPhoneInitRequestObject{
		Params: PostPhoneInitParams{
			Secret: "secret",
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
	if strings.Contains(xmlData, "<Gather") || strings.Contains(xmlData, "Enter entry code now, or hold.") {
		t.Fatalf("expected key unlock without preamble, got %s", xmlData)
	}
	if !strings.Contains(xmlData, "<Play") {
		t.Fatalf("expected unlock twiml, got %s", xmlData)
	}
}

func TestGetCallbox(t *testing.T) {
	s := newTestServer()
	if err := s.recordDoorOpenSignal(context.Background(), "entry_code", ""); err != nil {
		t.Fatalf("record door signal: %v", err)
	}

	resp, err := s.GetCallbox(context.Background(), GetCallboxRequestObject{})
	if err != nil {
		t.Fatalf("get key status: %v", err)
	}
	jsonResp, ok := resp.(GetCallbox200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if !jsonResp.Open {
		t.Fatalf("expected open=true")
	}
	if jsonResp.OpenUntil == nil || *jsonResp.OpenUntil == "" {
		t.Fatalf("expected openUntil when door is open")
	}
	if jsonResp.Source == nil || *jsonResp.Source != "entry_code" {
		t.Fatalf("unexpected source: %#v", jsonResp.Source)
	}
}

func TestPostCallboxStoresSubjectFromUserInfo(t *testing.T) {
	s := newTestServer()
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{Subject: "integration-test-local"})

	body := PostCallboxJSONRequestBody{Open: true}
	resp, err := s.PostCallbox(ctx, PostCallboxRequestObject{Body: &body})
	if err != nil {
		t.Fatalf("post me key: %v", err)
	}
	jsonResp, ok := resp.(PostCallbox200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if jsonResp.Subject != "integration-test-local" {
		t.Fatalf("unexpected subject: %q", jsonResp.Subject)
	}
	if _, ok, err := s.allowEntryViaWebKey(ctx); err != nil {
		t.Fatalf("check web key request: %v", err)
	} else if !ok {
		t.Fatalf("expected open request to allow web key entry")
	}

	statusResp, err := s.GetCallbox(ctx, GetCallboxRequestObject{})
	if err != nil {
		t.Fatalf("get callbox: %v", err)
	}
	status, ok := statusResp.(GetCallbox200JSONResponse)
	if !ok {
		t.Fatalf("unexpected status response type: %T", statusResp)
	}
	if !status.Open {
		t.Fatalf("expected open=true after post")
	}
	if status.Source == nil || *status.Source != "web_key_request" {
		t.Fatalf("unexpected source after post: %#v", status.Source)
	}
	if status.Subject == nil || *status.Subject != "integration-test-local" {
		t.Fatalf("unexpected subject after post: %#v", status.Subject)
	}
}

func TestPostCallboxLocksWhenOpenFalse(t *testing.T) {
	s := newTestServer()
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{Subject: "integration-test-local"})

	openBody := PostCallboxJSONRequestBody{Open: true}
	if _, err := s.PostCallbox(ctx, PostCallboxRequestObject{Body: &openBody}); err != nil {
		t.Fatalf("open callbox: %v", err)
	}

	closeBody := PostCallboxJSONRequestBody{Open: false}
	resp, err := s.PostCallbox(ctx, PostCallboxRequestObject{Body: &closeBody})
	if err != nil {
		t.Fatalf("close callbox: %v", err)
	}
	jsonResp, ok := resp.(PostCallbox200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if jsonResp.Subject != "integration-test-local" {
		t.Fatalf("unexpected subject: %q", jsonResp.Subject)
	}
	if _, ok, err := s.allowEntryViaWebKey(ctx); err != nil {
		t.Fatalf("check web key request: %v", err)
	} else if ok {
		t.Fatalf("expected close request to cancel web key entry")
	}

	statusResp, err := s.GetCallbox(ctx, GetCallboxRequestObject{})
	if err != nil {
		t.Fatalf("get callbox: %v", err)
	}
	status, ok := statusResp.(GetCallbox200JSONResponse)
	if !ok {
		t.Fatalf("unexpected status response type: %T", statusResp)
	}
	if status.Open {
		t.Fatalf("expected open=false after close")
	}
	if status.OpenUntil != nil {
		t.Fatalf("expected no openUntil after close, got %q", *status.OpenUntil)
	}
	if status.LastOpenedAt != nil {
		t.Fatalf("expected no lastOpenedAt after close, got %q", *status.LastOpenedAt)
	}
	if status.Source == nil || *status.Source != "web_key_lock" {
		t.Fatalf("unexpected source after close: %#v", status.Source)
	}
	if status.Subject == nil || *status.Subject != "integration-test-local" {
		t.Fatalf("unexpected subject after close: %#v", status.Subject)
	}
}

func TestGetCallboxEventsReturnsFriendlyPaginatedEvents(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()
	when := func(v string) Time {
		t.Helper()
		parsed, err := time.Parse(time.RFC3339, v)
		if err != nil {
			t.Fatalf("parse time: %v", err)
		}
		return Time{Time: parsed}
	}

	if err := s.putUserRecord(ctx, userRecord{
		Id:         "integration-test-local",
		When:       Now(),
		GivenName:  "Local",
		FamilyName: "Person",
	}); err != nil {
		t.Fatalf("put user: %v", err)
	}
	for _, rec := range []DoorOpenRecord{
		{
			Id:     callboxDoorOpenPartition,
			When:   when("2026-03-30T18:30:00Z"),
			Source: "entry_code",
			Open:   boolPtr(true),
		},
		{
			Id:      callboxDoorOpenPartition,
			When:    when("2026-03-30T18:31:00Z"),
			Source:  "web_key_request",
			Subject: "integration-test-local",
			Open:    boolPtr(true),
		},
		{
			Id:      callboxDoorOpenPartition,
			When:    when("2026-03-30T18:32:00Z"),
			Source:  "web_key_lock",
			Subject: "integration-test-local",
			Open:    boolPtr(false),
		},
	} {
		item, err := attributevalue.MarshalMap(rec)
		if err != nil {
			t.Fatalf("marshal record: %v", err)
		}
		if _, err := s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(s.keyRequestsTableName),
			Item:      item,
		}); err != nil {
			t.Fatalf("put key record: %v", err)
		}
	}

	limit := 2
	resp, err := s.GetCallboxEvents(ctx, GetCallboxEventsRequestObject{
		Params: GetCallboxEventsParams{Limit: &limit},
	})
	if err != nil {
		t.Fatalf("get callbox events: %v", err)
	}
	page, ok := resp.(GetCallboxEvents200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if len(page.Events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(page.Events))
	}
	if page.Events[0].Action != Locked || page.Events[0].Actor != "Local Person" {
		t.Fatalf("unexpected newest event: %#v", page.Events[0])
	}
	if page.Events[0].ActorGivenName == nil || *page.Events[0].ActorGivenName != "Local" {
		t.Fatalf("expected actor given name, got %#v", page.Events[0].ActorGivenName)
	}
	if page.Events[0].ActorFamilyName == nil || *page.Events[0].ActorFamilyName != "Person" {
		t.Fatalf("expected actor family name, got %#v", page.Events[0].ActorFamilyName)
	}
	if page.Events[1].Action != Unlocked || page.Events[1].Actor != "Local Person" {
		t.Fatalf("unexpected second event: %#v", page.Events[1])
	}
	if page.NextCursor == nil || *page.NextCursor == "" {
		t.Fatalf("expected next cursor")
	}

	resp, err = s.GetCallboxEvents(ctx, GetCallboxEventsRequestObject{
		Params: GetCallboxEventsParams{Cursor: page.NextCursor, Limit: &limit},
	})
	if err != nil {
		t.Fatalf("get second page: %v", err)
	}
	page, ok = resp.(GetCallboxEvents200JSONResponse)
	if !ok {
		t.Fatalf("unexpected second response type: %T", resp)
	}
	if len(page.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(page.Events))
	}
	if page.Events[0].Actor != "Entry code" || page.Events[0].Action != Unlocked {
		t.Fatalf("unexpected older event: %#v", page.Events[0])
	}
	if page.NextCursor != nil {
		t.Fatalf("expected no cursor after final page, got %q", *page.NextCursor)
	}
}

func TestGetCallboxEventsFallsBackToCurrentTokenProfile(t *testing.T) {
	s := newTestServer()
	ctx := context.WithValue(context.Background(), auth.IDTokenKey, &auth.IDToken{
		Subject:    "integration-test-local",
		Email:      "local@example.com",
		GivenName:  "Current",
		FamilyName: "Caller",
	})

	rec := DoorOpenRecord{
		Id:      callboxDoorOpenPartition,
		When:    Now(),
		Source:  "web_key_request",
		Subject: "integration-test-local",
		Open:    boolPtr(true),
	}
	item, err := attributevalue.MarshalMap(rec)
	if err != nil {
		t.Fatalf("marshal record: %v", err)
	}
	if _, err := s.ddb.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.keyRequestsTableName),
		Item:      item,
	}); err != nil {
		t.Fatalf("put key record: %v", err)
	}

	resp, err := s.GetCallboxEvents(ctx, GetCallboxEventsRequestObject{})
	if err != nil {
		t.Fatalf("get callbox events: %v", err)
	}
	page, ok := resp.(GetCallboxEvents200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}
	if len(page.Events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(page.Events))
	}
	if page.Events[0].Actor != "Current Caller" {
		t.Fatalf("unexpected actor: %#v", page.Events[0])
	}
	if page.Events[0].ActorEmail == nil || *page.Events[0].ActorEmail != "local@example.com" {
		t.Fatalf("expected actor email, got %#v", page.Events[0].ActorEmail)
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
