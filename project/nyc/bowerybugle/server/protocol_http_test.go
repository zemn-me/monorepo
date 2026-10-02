package server

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
)

var apiContract = sync.OnceValues(func() (routers.Router, error) {
	spec, err := GetSwagger()
	if err != nil {
		return nil, err
	}
	if err := spec.Validate(context.Background()); err != nil {
		return nil, err
	}
	spec.Servers = nil
	return gorillamux.NewRouter(spec)
})

// Apply the published response contract to the existing login, archive and
// publishing scenarios, including redirects, cookies and error responses.
func assertAPIResponse(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	request := response.Result().Request
	// Raw transport tests include OPTIONS, outside the spec.
	if request == nil {
		return
	}
	router, err := apiContract()
	if err != nil {
		t.Fatal(err)
	}
	route, params, err := router.FindRoute(request)
	if err != nil {
		t.Fatalf("request has no OpenAPI route: %v", err)
	}
	err = openapi3filter.ValidateResponse(t.Context(), &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{Request: request, Route: route, PathParams: params},
		Status:                 response.Code, Header: response.Header(), Body: io.NopCloser(bytes.NewReader(response.Body.Bytes())),
		Options: &openapi3filter.Options{IncludeResponseStatus: true},
	})
	if err != nil {
		t.Fatalf("%s %s violates OpenAPI response contract: %v", request.Method, request.URL.Path, err)
	}
}

func TestOpenAPIRejectsInvalidRequests(t *testing.T) {
	for _, test := range []struct{ name, method, path, body string }{
		{"missing body", "POST", "/api/issues", ""},
		{"null body", "POST", "/api/issues", "null"},
		{"missing required property", "POST", "/api/issues", `{}`},
		{"unknown property", "POST", "/api/issues", `{"number":7,"pdf":"unvalidated"}`},
		{"wrong type", "POST", "/api/issues", `{"number":"7"}`},
		{"fractional number", "POST", "/api/issues", `{"number":7.5}`},
		{"out of range", "POST", "/api/issues", `{"number":10000}`},
		{"trailing JSON", "POST", "/api/issues", `{"number":7}{"number":8}`},
		{"oversized body", "POST", "/api/issues", `{"number":7}` + strings.Repeat(" ", 4096)},
		{"missing upload size", "POST", "/api/uploads", `{"number":6}`},
		{"oversized PDF", "POST", "/api/uploads", `{"number":6,"size":52428801}`},
		{"invalid issue path", "DELETE", "/api/issues/nope", ""},
		{"out of range path", "DELETE", "/api/issues/10000", ""},
		{"invalid upload identifier", "POST", "/api/uploads/nope/publish", ""},
		{"invalid login code", "POST", "/api/login/confirm", `{"token":"secret-that-must-not-be-echoed"}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := setup()
			cookie := f.login(t)
			before := len(f.store.records)
			r := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
			r.Header.Set("Origin", f.server.Origin)
			r.Header.Set("Content-Type", "application/json")
			r.AddCookie(cookie)
			w := httptest.NewRecorder()
			f.server.Handler().ServeHTTP(w, r)
			w.Result().Request = r
			status(t, w, 400)
			if strings.TrimSpace(w.Body.String()) != `{"error":"Invalid request."}` {
				t.Fatalf("validation exposes request details: %s", w.Body.String())
			}
			if len(f.store.records) != before {
				t.Fatal("invalid request changed persisted state")
			}
		})
	}
}

type unavailableSessionStore struct{ Store }

func (s unavailableSessionStore) Get(context.Context, string, string) (Record, error) {
	return Record{}, errors.New("session storage unavailable")
}
func TestOpenAPIAuthenticationFailures(t *testing.T) {
	f := setup()
	cookie := f.login(t)
	f.server.Store = unavailableSessionStore{f.store}
	// Validator authentication errors must retain 503 instead of becoming 401/400.
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 7}, cookie), 503)
	status(t, f.request("GET", "/api/session", nil, cookie), 503)
	// Public operations do not require a healthy session store.
	status(t, f.request("GET", "/api/issues", nil, cookie), 200)
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 7}, &http.Cookie{Name: sessionCookie, Value: "invalid"}), 401)
}
