package apiserver

import (
	"context"
	"io"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/twilio/twilio-go/twiml"

	"github.com/zemn-me/monorepo/project/zemn.me/api/server/acnh"
)

type inMemoryDDB struct{ records []SettingsRecord }

func (db *inMemoryDDB) Query(ctx context.Context, in *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	if len(db.records) == 0 {
		return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{}}, nil
	}
	item, err := attributevalue.MarshalMap(db.records[len(db.records)-1])
	if err != nil {
		return nil, err
	}
	return &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}, nil
}

func (db *inMemoryDDB) PutItem(ctx context.Context, in *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	var rec SettingsRecord
	if err := attributevalue.UnmarshalMap(in.Item, &rec); err != nil {
		return nil, err
	}
	db.records = append(db.records, rec)
	return &dynamodb.PutItemOutput{}, nil
}

func newTestServer() *Server {
	return &Server{
		log:                log.New(io.Discard, "", 0),
		twilioSharedSecret: "secret",
		settingsTableName:  "settings",
		ddb:                &inMemoryDDB{},
		trackLookup:        acnh.Track,
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
	orig := s.trackLookup
	s.trackLookup = func(w acnh.Weather, t time.Time) (string, error) {
		return "sample.mp3", nil
	}
	defer func() { s.trackLookup = orig }()
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
