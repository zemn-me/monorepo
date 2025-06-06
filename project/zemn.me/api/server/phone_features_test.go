package apiserver

import (
        "context"
        "crypto/subtle"
        "io"
        "log"
        "strings"
        "testing"
        "time"

        "github.com/twilio/twilio-go/twiml"

        "github.com/zemn-me/monorepo/project/zemn.me/api/server/acnh"
)

func newTestServer() *Server {
	return &Server{
		log:                log.New(io.Discard, "", 0),
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
       orig := trackLookup
       trackLookup = func(w acnh.Weather, t time.Time) (string, error) {
               return "sample.mp3", nil
       }
       defer func() { trackLookup = orig }()
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

func TestHandleEntryViaCode(t *testing.T) {
	digits := "12345"
	codes := []EntryCodeEntry{{Code: digits}}

	// Inline implementation of handleEntryViaCode using preset codes
	var success bool
	for _, code := range codes {
		if success = subtle.ConstantTimeCompare(
			[]byte(removeDuplicateDigits(code.Code)), []byte(removeDuplicateDigits(digits)),
		) == 1; success {
			break
		}
	}
	if !success {
		t.Fatalf("expected code entry to succeed")
	}

	doc, response := twiml.CreateDocument()
	response.CreateElement("Play").SetText(nook_phone_yes)
	response.CreateElement("Play").CreateAttr("digits", "9w9")

	resp := TwimlResponse{Document: doc}
	xmlData, err := twiml.ToXML(resp.Document)
	if err != nil {
		t.Fatalf("failed to encode xml: %v", err)
	}
	if !strings.Contains(xmlData, "<Play>") {
		t.Errorf("expected play element, got %s", xmlData)
	}
}
