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
        log:               log.New(io.Discard, "", 0),
        twilioSharedSecret: "secret",
    }
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
    if !strings.Contains(xmlData, "<Play>") {
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

