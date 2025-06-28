package apiserver

import (
<<<<<<< dest:   c1cfcd813bc2 - thomas: Fix call retry without shared memory
	"context"
	"io"
	"log"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/twilio/twilio-go/twiml"
||||||| base:   b5e6a0ac6959 - zemnmez+renovate: fix(deps): update dependency...
	"context"
	"io"
       "log"
       "strings"
       "testing"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/twilio/twilio-go/twiml"

=======
        "context"
        "io"
        "log"
        "strings"
        "testing"

       "github.com/twilio/twilio-go/twiml"
>>>>>>> source: 967ebf2c0e9c - thomas: Grievance API
)


func newTestServer() *Server {
<<<<<<< dest:   c1cfcd813bc2 - thomas: Fix call retry without shared memory
        return &Server{
                log:                log.New(io.Discard, "", 0),
                twilioSharedSecret: "secret",
                settingsTableName:  "settings",
                ddb:                &inMemoryDDB{},
        }
||||||| base:   b5e6a0ac6959 - zemnmez+renovate: fix(deps): update dependency...
	return &Server{
		log:                log.New(io.Discard, "", 0),
		twilioSharedSecret: "secret",
		settingsTableName:  "settings",
		ddb:                &inMemoryDDB{},
	}
=======
	return &Server{
		log:                 log.New(io.Discard, "", 0),
		twilioSharedSecret:  "secret",
		settingsTableName:   "settings",
		grievancesTableName: "grievances",
		ddb:                 &inMemoryDDB{},
	}
>>>>>>> source: 967ebf2c0e9c - thomas: Grievance API
}

func TestPostPhoneJoinConference(t *testing.T) {
	s := newTestServer()
	rq := PostPhoneJoinConferenceRequestObject{
		Params: PostPhoneJoinConferenceParams{Secret: "secret"},
	}
	rs, err := s.postPhoneJoinConference(context.Background(), rq)
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
        if !strings.Contains(xmlData, "<Gather") ||
                !strings.Contains(xmlData, "Press 1 to accept this call") ||
                !strings.Contains(xmlData, "attempt=1") {
                t.Errorf("unexpected xml: %s", xmlData)
        }
}

func TestPostPhoneJoinConferenceDigitsAccepted(t *testing.T) {
    s := newTestServer()
    digit := "1"
    rq := PostPhoneJoinConferenceRequestObject{
        Params: PostPhoneJoinConferenceParams{Secret: "secret"},
        Body:   &TwilioCallRequest{Digits: &digit},
    }
    rs, err := s.postPhoneJoinConference(context.Background(), rq)
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
    if !strings.Contains(xmlData, "<Conference") || !strings.Contains(xmlData, TWILIO_CONFERENCE_NAME) {
        t.Errorf("unexpected xml: %s", xmlData)
    }
}


func TestPostPhoneHoldMusic(t *testing.T) {
	s := newTestServer()
	rq := PostPhoneHoldMusicRequestObject{
		Params: PostPhoneHoldMusicParams{Secret: "secret"},
	}
	rs, err := s.postPhoneHoldMusic(context.Background(), rq)
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
