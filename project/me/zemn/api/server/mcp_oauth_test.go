package apiserver

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/go-jose/go-jose/v4/jwt"
)

type oauthTestDDB struct {
	*inMemoryDDB
	mu      sync.Mutex
	records map[string]map[string]types.AttributeValue
}

func (db *oauthTestDDB) GetItem(ctx context.Context, in *dynamodb.GetItemInput, opts ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error) {
	if aws.ToString(in.TableName) != "oauth" {
		return db.inMemoryDDB.GetItem(ctx, in, opts...)
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	return &dynamodb.GetItemOutput{Item: db.records[in.Key["id"].(*types.AttributeValueMemberS).Value]}, nil
}
func (db *oauthTestDDB) PutItem(ctx context.Context, in *dynamodb.PutItemInput, opts ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	if aws.ToString(in.TableName) != "oauth" {
		return db.inMemoryDDB.PutItem(ctx, in, opts...)
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	id := in.Item["id"].(*types.AttributeValueMemberS).Value
	old := db.records[id]
	if aws.ToString(in.ConditionExpression) == "attribute_not_exists(id)" && old != nil {
		return nil, &types.ConditionalCheckFailedException{}
	}
	if expected, ok := in.ExpressionAttributeValues[":previous"].(*types.AttributeValueMemberS); ok {
		if old == nil || old["data"].(*types.AttributeValueMemberS).Value != expected.Value {
			return nil, &types.ConditionalCheckFailedException{}
		}
	}
	if db.records == nil {
		db.records = map[string]map[string]types.AttributeValue{}
	}
	db.records[id] = in.Item
	return &dynamodb.PutItemOutput{}, nil
}
func (db *oauthTestDDB) DeleteItem(ctx context.Context, in *dynamodb.DeleteItemInput, opts ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
	if aws.ToString(in.TableName) != "oauth" {
		return db.inMemoryDDB.DeleteItem(ctx, in, opts...)
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	id := in.Key["id"].(*types.AttributeValueMemberS).Value
	old := db.records[id]
	if expected, ok := in.ExpressionAttributeValues[":previous"].(*types.AttributeValueMemberS); ok {
		if old == nil || old["data"].(*types.AttributeValueMemberS).Value != expected.Value {
			return nil, &types.ConditionalCheckFailedException{}
		}
	}
	delete(db.records, id)
	return &dynamodb.DeleteItemOutput{}, nil
}
func oauthTestRequest(s *Server, method, path, body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if strings.HasPrefix(body, "{") {
		request.Header.Set("Content-Type", "application/json")
	} else {
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	s.ServeHTTP(response, request)
	return response
}
func oauthTestJSON(t *testing.T, response *httptest.ResponseRecorder, status int) map[string]any {
	t.Helper()
	if response.Code != status {
		t.Fatalf("status %d, want %d: %s", response.Code, status, response.Body)
	}
	result := map[string]any{}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}
func oauthTestClient(t *testing.T, s *Server) string {
	return oauthTestJSON(t, oauthTestRequest(s, "POST", "/oauth2/register", `{"client_name":"Diary test","redirect_uris":["https://client.example/callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"none"}`, ""), 201)["client_id"].(string)
}
func oauthTestCode(t *testing.T, s *Server, client, verifier string) url.Values {
	t.Helper()
	params := url.Values{"client_id": {client}, "response_type": {"code"}, "redirect_uri": {"https://client.example/callback"}, "resource": {oauthURL(journalMCPPath)}, "scope": {"journal_read"}, "state": {"client-state"}, "code_challenge_method": {"S256"}, "code_challenge": {oauthHash(verifier)}}
	response := oauthTestRequest(s, "GET", "/oauth2/authorize?"+params.Encode(), "", "")
	if response.Code != 302 {
		t.Fatalf("authorize: %d %s", response.Code, response.Body)
	}
	location, _ := url.Parse(response.Header().Get("Location"))
	requestID := location.Query().Get("request")
	details := oauthTestJSON(t, oauthTestRequest(s, "GET", oauthRequestPath+requestID, "", ""), 200)
	if details["client_name"] != "Diary test" || details["scope"] != "journal_read" {
		t.Fatalf("unexpected consent: %v", details)
	}
	identity, err := s.IssueJWT(t.Context(), jwt.Claims{Issuer: oauthURL(""), Subject: journalOwnerSubject, Audience: jwt.Audience{zemnMeClient}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))})
	if err != nil {
		t.Fatal(err)
	}
	result := oauthTestJSON(t, oauthTestRequest(s, "POST", oauthRequestPath+requestID, `{"approve":true}`, identity), 200)
	redirect, _ := url.Parse(result["redirect_uri"].(string))
	if redirect.Query().Get("state") != "client-state" || redirect.Query().Get("iss") != oauthURL("") {
		t.Fatal("lost state or issuer")
	}
	oauthTestJSON(t, oauthTestRequest(s, "POST", oauthRequestPath+requestID, `{"approve":true}`, identity), 400)
	return url.Values{"grant_type": {"authorization_code"}, "code": {redirect.Query().Get("code")}, "client_id": {client}, "redirect_uri": {"https://client.example/callback"}, "resource": {oauthURL(journalMCPPath)}, "code_verifier": {verifier}}
}
func TestMCPOAuthConnectionLifecycle(t *testing.T) {
	s := newJournalMCPTestServer(t)
	client := oauthTestClient(t, s)
	form := oauthTestCode(t, s, client, strings.Repeat("v", 43))
	for _, field := range []string{"code_verifier", "client_id", "redirect_uri", "resource"} {
		original := form.Get(field)
		form.Set(field, "incorrect")
		oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), ""), 400)
		form.Set(field, original)
	}
	tokens := oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), ""), 200)
	access := tokens["access_token"].(string)
	refresh := tokens["refresh_token"].(string)
	info, err := s.verifyJournalMCPToken(t.Context(), access, nil)
	if err != nil || info.UserID != journalOwnerSubject {
		t.Fatalf("access token: %v %v", info, err)
	}
	if _, err = s.verifyJournalIdentity(t.Context(), access, nil); err == nil {
		t.Fatal("MCP token granted website access")
	}
	if _, err = s.verifyJournalMCPToken(t.Context(), refresh, nil); err == nil {
		t.Fatal("refresh token accepted as access token")
	}
	oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), ""), 400)
	renewal := url.Values{"grant_type": {"refresh_token"}, "refresh_token": {refresh}, "client_id": {client}, "resource": {oauthURL(journalMCPPath)}}
	fresh := oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, renewal.Encode(), ""), 200)
	if fresh["refresh_token"] == refresh {
		t.Fatal("refresh token not rotated")
	}
	oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, renewal.Encode(), ""), 400)
	if _, err = s.verifyJournalMCPToken(t.Context(), fresh["access_token"].(string), nil); err == nil {
		t.Fatal("refresh replay failed to revoke the grant")
	}
	renewal.Set("refresh_token", fresh["refresh_token"].(string))
	oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, renewal.Encode(), ""), 400)
	form = oauthTestCode(t, s, client, strings.Repeat("z", 43))
	tokens = oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), ""), 200)
	revoke := url.Values{"token": {tokens["refresh_token"].(string)}, "client_id": {client}}
	if response := oauthTestRequest(s, "POST", "/oauth2/mcp/revoke", revoke.Encode(), ""); response.Code != 200 {
		t.Fatal(response.Code)
	}
	if _, err = s.verifyJournalMCPToken(t.Context(), tokens["access_token"].(string), nil); err == nil {
		t.Fatal("revoked access token accepted")
	}
}
func TestMCPOAuthDiscoveryAndValidation(t *testing.T) {
	s := newJournalMCPTestServer(t)
	metadata := oauthTestJSON(t, oauthTestRequest(s, "GET", "/.well-known/oauth-authorization-server", "", ""), 200)
	if metadata["registration_endpoint"] != oauthURL("/oauth2/register") || metadata["client_id_metadata_document_supported"] != true {
		t.Fatal(metadata)
	}
	resource := oauthTestJSON(t, oauthTestRequest(s, "GET", oauthResourceMetadataPath, "", ""), 200)
	if resource["resource"] != oauthURL(journalMCPPath) {
		t.Fatal(resource)
	}
	response := oauthTestRequest(s, "GET", journalMCPPath, "", "")
	if !strings.Contains(response.Header().Get("WWW-Authenticate"), oauthURL(oauthResourceMetadataPath)) {
		t.Fatal("missing discovery challenge")
	}
	for _, redirect := range []string{"http://attacker.example/cb", "https://client.example/#fragment", "https://user:pass@client.example/cb", "javascript:alert(1)"} {
		body, _ := json.Marshal(map[string]any{"client_name": "Bad", "redirect_uris": []string{redirect}})
		oauthTestJSON(t, oauthTestRequest(s, "POST", "/oauth2/register", string(body), ""), 400)
	}
	for _, ip := range []string{"127.0.0.1", "::1", "10.1.1.1", "169.254.169.254", "100.100.100.200", "::ffff:127.0.0.1", "64:ff9b::a00:1"} {
		if oauthPublicIP(netip.MustParseAddr(ip)) {
			t.Fatalf("private metadata destination accepted: %s", ip)
		}
	}
	if !oauthPublicIP(netip.MustParseAddr("8.8.8.8")) {
		t.Fatal("public address blocked")
	}
	request := httptest.NewRequest("POST", oauthRequestPath+"request", strings.NewReader(`{"approve":true}`))
	request.Header.Set("Origin", "https://attacker.example")
	response = httptest.NewRecorder()
	s.ServeHTTP(response, request)
	if response.Code != 403 {
		t.Fatal("cross-origin consent allowed")
	}
}

func TestMCPOAuthClientMetadata(t *testing.T) {
	const id = "https://client.example/oauth/client.json"
	for _, test := range []struct {
		name, body string
		valid      bool
	}{
		{"valid", `{"client_id":"https://client.example/oauth/client.json","client_name":"Metadata client","redirect_uris":["http://127.0.0.1:3000/callback"],"token_endpoint_auth_method":"none"}`, true},
		{"mismatched identity", `{"client_id":"https://other.example/client.json","client_name":"Metadata client","redirect_uris":["https://client.example/callback"]}`, false},
		{"missing name", `{"client_id":"https://client.example/oauth/client.json","redirect_uris":["https://client.example/callback"]}`, false},
		{"invalid redirect", `{"client_id":"https://client.example/oauth/client.json","client_name":"Metadata client","redirect_uris":["http://private.example/callback"]}`, false},
		{"oversized", strings.Repeat(" ", 16385), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.URL.String() != id || r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
					t.Fatal("metadata request leaked credentials or used wrong URL")
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(test.body)), Header: make(http.Header)}, nil
			})}
			_, err := oauthFetchClientMetadata(t.Context(), id, client)
			if (err == nil) != test.valid {
				t.Fatalf("metadata validation: %v", err)
			}
		})
	}
	s := newJournalMCPTestServer(t)
	if _, err := s.oauthResolveClient(t.Context(), "https://127.0.0.1/client.json"); err == nil {
		t.Fatal("fetched private client metadata")
	}
}

func TestMCPOAuthExpiredAndConcurrentCredentials(t *testing.T) {
	s := newJournalMCPTestServer(t)
	if err := s.oauthPut(t.Context(), "code", "expired", oauthAuthorization{}, time.Now().Add(-time.Minute), ""); err != nil {
		t.Fatal(err)
	}
	var code oauthAuthorization
	if _, err := s.oauthGet(t.Context(), "code", "expired", &code); err == nil {
		t.Fatal("expired code accepted before DynamoDB TTL cleanup")
	}
	form := oauthTestCode(t, s, oauthTestClient(t, s), strings.Repeat("a", 43))
	results := make(chan int, 2)
	for range 2 {
		go func() { results <- oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), "").Code }()
	}
	a, b := <-results, <-results
	if !((a == 200 && b == 400) || (a == 400 && b == 200)) {
		t.Fatalf("concurrent redemption: %d, %d", a, b)
	}
}

func TestMCPOAuthAuthorizationRejectsUnapprovedRequests(t *testing.T) {
	s := newJournalMCPTestServer(t)
	client := oauthTestClient(t, s)
	params := url.Values{"client_id": {client}, "response_type": {"code"}, "redirect_uri": {"https://client.example/callback"}, "resource": {oauthURL(journalMCPPath)}, "scope": {"journal_read"}, "code_challenge_method": {"S256"}, "code_challenge": {oauthHash(strings.Repeat("v", 43))}}
	for _, field := range []string{"client_id", "redirect_uri", "resource", "scope", "code_challenge_method", "code_challenge", "response_type"} {
		original := params.Get(field)
		params.Set(field, "invalid")
		response := oauthTestRequest(s, "GET", "/oauth2/authorize?"+params.Encode(), "", "")
		if response.Code != 400 || response.Header().Get("Location") != "" {
			t.Fatalf("invalid %s redirected or accepted", field)
		}
		params.Set(field, original)
	}
	response := oauthTestRequest(s, "GET", "/oauth2/authorize?"+params.Encode(), "", "")
	location, _ := url.Parse(response.Header().Get("Location"))
	path := oauthRequestPath + location.Query().Get("request")
	oauthTestJSON(t, oauthTestRequest(s, "POST", path, `{"approve":true}`, ""), 401)
	other, err := s.IssueJWT(t.Context(), jwt.Claims{Issuer: oauthURL(""), Subject: "keng", Audience: jwt.Audience{zemnMeClient}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))})
	if err != nil {
		t.Fatal(err)
	}
	oauthTestJSON(t, oauthTestRequest(s, "POST", path, `{"approve":true}`, other), 403)
	// Failed sign-in attempts must not consume the pending request.
	oauthTestJSON(t, oauthTestRequest(s, "GET", path, "", ""), 200)
}

func TestMCPOAuthDiscoveryUsesConfiguredOrigin(t *testing.T) {
	s := newJournalMCPTestServer(t)
	t.Setenv("ZEMN_API_ORIGIN", "https://api.staging.zemn.me")
	for _, path := range []string{"/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"} {
		metadata := oauthTestJSON(t, oauthTestRequest(s, "GET", path, "", ""), 200)
		if metadata["issuer"] != "https://api.staging.zemn.me" || metadata["token_endpoint"] != "https://api.staging.zemn.me/oauth2/mcp/token" || metadata["client_id_metadata_document_supported"] != true {
			t.Fatalf("incorrect discovery: %v", metadata)
		}
	}
	if resource := oauthURL(journalMCPPath); resource != "https://api.staging.zemn.me/journal/mcp" {
		t.Fatal(resource)
	}
}

func TestMCPOAuthConcurrentRefreshRevokesConnection(t *testing.T) {
	s := newJournalMCPTestServer(t)
	client := oauthTestClient(t, s)
	form := oauthTestCode(t, s, client, strings.Repeat("r", 43))
	tokens := oauthTestJSON(t, oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), ""), 200)
	form = url.Values{"grant_type": {"refresh_token"}, "client_id": {client}, "refresh_token": {tokens["refresh_token"].(string)}, "resource": {oauthURL(journalMCPPath)}}
	responses := make(chan *httptest.ResponseRecorder, 2)
	for range 2 {
		go func() { responses <- oauthTestRequest(s, "POST", oauthTokenPath, form.Encode(), "") }()
	}
	a, b := <-responses, <-responses
	if a.Code != 200 {
		a, b = b, a
	}
	winner := oauthTestJSON(t, a, 200)
	oauthTestJSON(t, b, 400)
	if _, err := s.verifyJournalMCPToken(t.Context(), winner["access_token"].(string), nil); err == nil {
		t.Fatal("concurrent refresh reuse did not revoke the winning token")
	}
}
