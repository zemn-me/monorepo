package apiserver

import (
	"bytes"
	"io"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/go-jose/go-jose/v4/jwt"
	apiSpec "github.com/zemn-me/monorepo/project/me/zemn/api"
)

var protocolContract = sync.OnceValues(func() (routers.Router, error) {
	spec, err := openapi3.NewLoader().LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		return nil, err
	}
	spec.Servers = nil
	return gorillamux.NewRouter(spec)
})

func assertProtocolResponse(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	request := response.Result().Request
	if request == nil {
		t.Fatal("response has no originating request")
	}
	router, err := protocolContract()
	if err != nil {
		t.Fatal(err)
	}
	route, params, err := router.FindRoute(request)
	if err != nil {
		t.Fatalf("request has no Swagger route: %v", err)
	}
	err = openapi3filter.ValidateResponse(t.Context(), &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{Request: request, Route: route, PathParams: params},
		Status:                 response.Code, Header: response.Header(), Body: io.NopCloser(bytes.NewReader(response.Body.Bytes())),
		Options: &openapi3filter.Options{IncludeResponseStatus: true},
	})
	if err != nil {
		t.Fatalf("%s %s response violates Swagger: %v", request.Method, request.URL.Path, err)
	}
}

func TestJournalMCPSwaggerEnvelope(t *testing.T) {
	s := newJournalMCPTestServer(t)
	token := journalMCPTestToken(t, s, journalMCPTestClaims())
	for _, test := range []struct {
		name, body string
		status     int
	}{
		{"initialize", `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"swagger-test","version":"1"}}}`, 200},
		{"notification", `{"jsonrpc":"2.0","method":"notifications/initialized"}`, 202},
		{"wrong version", `{"jsonrpc":"1.0","id":1,"method":"tools/list"}`, 400},
		{"missing version", `{"id":1,"method":"tools/list"}`, 400},
		{"invalid method type", `{"jsonrpc":"2.0","method":123}`, 400},
		{"batch", `[{"jsonrpc":"2.0","method":"notifications/initialized"}]`, 400},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest("POST", journalMCPPath, strings.NewReader(test.body))
			request.Header.Set("Authorization", "Bearer "+token)
			request.Header.Set("Accept", "application/json, text/event-stream")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			s.ServeHTTP(response, request)
			response.Result().Request = request
			if response.Code != test.status {
				t.Fatalf("status %d, want %d: %s", response.Code, test.status, response.Body)
			}
			assertProtocolResponse(t, response)
		})
	}
}
func TestOAuthSwaggerRequiresExplicitConsentDecision(t *testing.T) {
	s := newJournalMCPTestServer(t)
	id := oauthRandom()
	if err := s.oauthPut(t.Context(), "request", id, oauthAuthorization{Client: oauthClient{ClientName: "Consent test", ClientId: "test"}}, time.Now().Add(time.Minute), ""); err != nil {
		t.Fatal(err)
	}
	identity, err := s.IssueJWT(t.Context(), jwt.Claims{Issuer: oauthURL(""), Subject: journalOwnerSubject, Audience: jwt.Audience{zemnMeClient}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))})
	if err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{`{}`, `{"approve":"yes"}`, `{"approve":null}`, `{"approve":true} {"approve":false}`} {
		response := oauthTestRequest(s, "POST", oauthRequestPath+id, body, identity)
		oauthTestJSON(t, response, 400)
	}
	// Invalid bodies must never consume the pending authorization request.
	oauthTestJSON(t, oauthTestRequest(s, "GET", oauthRequestPath+id, "", ""), 200)
}
