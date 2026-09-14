package apiserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func newJournalMCPTestServer(t *testing.T) *Server {
	t.Helper()
	t.Setenv("ASSIGNED_PORTS", "")
	s, err := NewServer(t.Context(), NewServerOptions{})
	if err != nil {
		t.Fatal(err)
	}
	s.ddb = &inMemoryDDB{}
	s.journalTableName = "journal"
	s.usersTableName = ""
	return s
}

func journalMCPTestClaims() jwt.Claims {
	return jwt.Claims{Issuer: "https://api.zemn.me", Subject: journalOwnerSubject,
		Audience: jwt.Audience{zemnMeClient}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}
}

func journalMCPTestToken(t *testing.T, s *Server, claims jwt.Claims) string {
	t.Helper()
	token, err := s.IssueJWT(t.Context(), claims)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestJournalMCPAuthentication(t *testing.T) {
	s := newJournalMCPTestServer(t)
	// Even an account explicitly granted journal_read must pass the owner check.
	s.usersTableName = "users"
	db := s.ddb.(*inMemoryDDB)
	db.users = map[string]userRecord{"other": {Id: "other", Scopes: []string{"journal_read"}}}
	otherSigner := newJournalMCPTestServer(t)
	for _, test := range []struct {
		name   string
		mutate func(*jwt.Claims)
		raw    string
		signer *Server
		status int
	}{
		{name: "missing", status: 401},
		{name: "malformed", raw: "Bearer not-a-jwt", status: 401},
		{name: "wrong signature", signer: otherSigner, status: 401},
		{name: "wrong issuer", mutate: func(c *jwt.Claims) { c.Issuer = "https://attacker.invalid" }, status: 401},
		{name: "wrong audience", mutate: func(c *jwt.Claims) { c.Audience = jwt.Audience{"other-service"} }, status: 401},
		{name: "expired", mutate: func(c *jwt.Claims) { c.Expiry = jwt.NewNumericDate(time.Now().Add(-time.Hour)) }, status: 401},
		{name: "missing expiry", mutate: func(c *jwt.Claims) { c.Expiry = nil }, status: 401},
		{name: "not yet valid", mutate: func(c *jwt.Claims) { c.NotBefore = jwt.NewNumericDate(time.Now().Add(time.Hour)) }, status: 401},
		{name: "missing subject", mutate: func(c *jwt.Claims) { c.Subject = "" }, status: 401},
		{name: "missing scope", mutate: func(c *jwt.Claims) { c.Subject = "keng" }, status: 403},
		{name: "non-owner with scope", mutate: func(c *jwt.Claims) { c.Subject = "other" }, status: 403},
	} {
		t.Run(test.name, func(t *testing.T) {
			authorization := test.raw
			if test.mutate != nil || test.signer != nil {
				claims := journalMCPTestClaims()
				if test.mutate != nil {
					test.mutate(&claims)
				}
				signer := test.signer
				if signer == nil {
					signer = s
				}
				authorization = "Bearer " + journalMCPTestToken(t, signer, claims)
			}
			for _, method := range []string{http.MethodPost, http.MethodGet, http.MethodDelete} {
				req := httptest.NewRequest(method, journalMCPPath, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
				req.Header.Set("Authorization", authorization)
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Accept", "application/json, text/event-stream")
				// Session identifiers must never substitute for a valid bearer token.
				req.Header.Set("Mcp-Session-Id", "previous-session")
				recorder := httptest.NewRecorder()
				s.ServeHTTP(recorder, req)
				if recorder.Code != test.status {
					t.Fatalf("%s: status %d: %s", method, recorder.Code, recorder.Body.String())
				}
				if recorder.Header().Get("Cache-Control") != "private, no-store" {
					t.Fatal("private response is cacheable")
				}
				if test.status == 401 && !strings.Contains(recorder.Header().Get("WWW-Authenticate"), "Bearer") {
					t.Fatal("missing bearer challenge")
				}
			}
		})
	}
}

func TestJournalMCPClient(t *testing.T) {
	s := newJournalMCPTestServer(t)
	now := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	firstID := "10000000-0000-4000-8000-000000000001"
	secondID := "10000000-0000-4000-8000-000000000002"
	summary := JournalSummary{Id: "day:2026-09-01", Period: JournalSummaryPeriodDay, Start: now, End: now.Add(24 * time.Hour), Title: "Garden", Blocks: []JournalSummaryBlock{{Markdown: "Planted rosemary.[^1]", Citations: []JournalCitation{{EntryId: firstID, SegmentId: "s0", Quote: "Planted rosemary today"}}}}}
	for _, item := range []struct {
		id, subject, text string
		status            JournalEntryStatus
		at                time.Time
	}{
		{firstID, journalOwnerSubject, "Planted rosemary today", JournalEntryStatusReady, now},
		{secondID, journalOwnerSubject, "Watered the garden", JournalEntryStatusReady, now.Add(-time.Hour)},
		{"10000000-0000-4000-8000-000000000003", "other", "Private rosemary", JournalEntryStatusReady, now},
		{"10000000-0000-4000-8000-000000000004", journalOwnerSubject, "Unfinished rosemary", JournalEntryStatusProcessing, now},
	} {
		entry := JournalStoredEntry{Id: item.id, Status: item.status, RecordedAt: item.at, TimeZone: "UTC", Transcript: []JournalTranscriptSegment{{Id: "s0", Text: item.text}}}
		if item.id == firstID {
			entry.Summary = &summary
		}
		if err := s.putJournalRecord(t.Context(), JournalStoredRecord{Id: item.subject, When: journalEntryRecordKey(item.id), Kind: JournalStoredRecordKindEntry, Entry: &entry}); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.putJournalRecord(t.Context(), JournalStoredRecord{Id: journalOwnerSubject, When: "SUMMARY#day", Kind: JournalStoredRecordKindSummary, Summary: &summary}); err != nil {
		t.Fatal(err)
	}
	token, err := s.IssueIdToken(t.Context(), IdToken{
		Iss: "https://api.zemn.me", Sub: journalOwnerSubject, Aud: OAuthClientId(zemnMeClient),
		Iat: time.Now().Unix(), Exp: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	endpoint := httptest.NewServer(s)
	defer endpoint.Close()
	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		clone := req.Clone(req.Context())
		clone.Header.Set("Authorization", "Bearer "+token)
		return http.DefaultTransport.RoundTrip(clone)
	})}
	client := mcp.NewClient(&mcp.Implementation{Name: "journal-test", Version: "1"}, nil)
	session, err := client.Connect(t.Context(), &mcp.StreamableClientTransport{Endpoint: endpoint.URL + journalMCPPath, HTTPClient: httpClient, DisableStandaloneSSE: true}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	tools, err := session.ListTools(t.Context(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools.Tools) != 3 {
		t.Fatalf("tools: %+v", tools.Tools)
	}
	for _, tool := range tools.Tools {
		if tool.Annotations == nil || !tool.Annotations.ReadOnlyHint {
			t.Fatalf("tool is not read-only: %s", tool.Name)
		}
	}
	call := func(name string, args any, dest any) *mcp.CallToolResult {
		t.Helper()
		result, err := session.CallTool(t.Context(), &mcp.CallToolParams{Name: name, Arguments: args})
		if err != nil {
			t.Fatal(err)
		}
		if dest != nil {
			if result.IsError {
				t.Fatalf("%s: %+v", name, result.Content)
			}
			data, err := json.Marshal(result.StructuredContent)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(data, dest); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	var matches journalMCPSearchResult
	call("search_journal", map[string]any{"query": "ROSEMARY"}, &matches)
	if len(matches.Entries) != 1 || matches.Entries[0].ID != firstID {
		t.Fatalf("search returned %+v", matches)
	}
	call("search_journal", map[string]any{"limit": 1}, &matches)
	if len(matches.Entries) != 1 || matches.Entries[0].ID != firstID || matches.NextOffset == nil || *matches.NextOffset != 1 {
		t.Fatalf("page: %+v", matches)
	}
	matches = journalMCPSearchResult{}
	call("search_journal", map[string]any{"limit": 1, "offset": 1}, &matches)
	if len(matches.Entries) != 1 || matches.Entries[0].ID != secondID || matches.NextOffset != nil {
		t.Fatalf("second page: %+v", matches)
	}
	call("search_journal", map[string]any{"start": now.Format(time.RFC3339), "end": now.Add(time.Hour).Format(time.RFC3339)}, &matches)
	if len(matches.Entries) != 1 || matches.Entries[0].ID != firstID {
		t.Fatalf("time filter: %+v", matches)
	}
	var entry journalMCPEntry
	result := call("get_journal_entry", map[string]any{"id": firstID}, &entry)
	if entry.ID != firstID || entry.Transcript[0].Text != "Planted rosemary today" || !reflect.DeepEqual(entry.Summary, &summary) {
		t.Fatalf("entry: %+v", entry)
	}
	encoded, _ := json.Marshal(result)
	if strings.Contains(string(encoded), "audioUrl") || strings.Contains(string(encoded), "audioKey") {
		t.Fatal("MCP exposed private audio credentials")
	}
	var summaries journalMCPSummaryResult
	call("list_journal_summaries", map[string]any{"period": "day"}, &summaries)
	if len(summaries.Summaries) != 1 || !reflect.DeepEqual(summaries.Summaries[0], summary) {
		t.Fatalf("summaries: %+v", summaries)
	}
	for _, invalid := range []struct {
		name string
		args any
	}{
		{"search_journal", map[string]any{"start": "invalid"}},
		{"search_journal", map[string]any{"offset": -1}},
		{"search_journal", map[string]any{"limit": 51}},
		{"get_journal_entry", map[string]any{"id": "invalid"}},
		{"get_journal_entry", map[string]any{"id": "10000000-0000-4000-8000-000000000003"}},
		{"get_journal_entry", map[string]any{"id": "10000000-0000-4000-8000-000000000004"}},
		{"list_journal_summaries", map[string]any{"period": "invalid"}},
	} {
		if !call(invalid.name, invalid.args, nil).IsError {
			t.Fatalf("accepted invalid tool input: %+v", invalid)
		}
	}
	// Removing authentication after initialization must deny the next call.
	token = "invalid"
	if _, err := session.ListTools(t.Context(), nil); err == nil {
		t.Fatal("MCP session bypassed authentication")
	}
}

func TestJournalMCPRejectsCrossOrigin(t *testing.T) {
	s := newJournalMCPTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "https://api.zemn.me"+journalMCPPath, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	req.Header.Set("Authorization", "Bearer "+journalMCPTestToken(t, s, journalMCPTestClaims()))
	req.Header.Set("Origin", "https://attacker.invalid")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	recorder := httptest.NewRecorder()
	s.ServeHTTP(recorder, req)
	if recorder.Code != 403 {
		t.Fatalf("status %d: %s", recorder.Code, recorder.Body.String())
	}
}

type paginatedJournalDDB struct {
	*inMemoryDDB
	calls int
}

func (db *paginatedJournalDDB) Query(_ context.Context, input *dynamodb.QueryInput, _ ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	db.calls++
	index := 0
	if len(input.ExclusiveStartKey) > 0 {
		index = 1
	}
	entry := JournalStoredRecord{Id: journalOwnerSubject, When: []string{"first", "second"}[index]}
	item, err := attributevalue.MarshalMap(entry)
	if err != nil {
		return nil, err
	}
	out := &dynamodb.QueryOutput{Items: []map[string]types.AttributeValue{item}}
	if index == 0 {
		out.LastEvaluatedKey = map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: journalOwnerSubject}, "when": &types.AttributeValueMemberS{Value: "first"}}
	}
	if aws.ToString(input.TableName) != "journal" {
		panic("wrong table")
	}
	return out, nil
}
func TestJournalReadsAllDynamoDBPages(t *testing.T) {
	db := &paginatedJournalDDB{inMemoryDDB: &inMemoryDDB{}}
	s := &Server{ddb: db, journalTableName: "journal"}
	records, err := s.listJournalRecords(t.Context(), journalOwnerSubject)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 || records[1].When != "second" || db.calls != 2 {
		t.Fatalf("records=%+v calls=%d", records, db.calls)
	}
}
