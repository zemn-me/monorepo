package apiserver

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coreos/go-oidc"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

func newOIDCAuthenticationTestServer(t *testing.T, opts NewServerOptions) *Server {
	t.Helper()
	previousResolver := auth.ScopeResolver
	t.Cleanup(func() { auth.ScopeResolver = previousResolver })
	t.Setenv("ASSIGNED_PORTS", "")
	t.Setenv("ZEMN_TEST_OIDC_ISSUER", "")
	t.Setenv("ZEMN_TEST_OIDC_PROVIDER", "")
	s, err := NewServer(t.Context(), opts)
	if err != nil {
		t.Fatal(err)
	}
	s.ddb = &inMemoryDDB{}
	s.usersTableName = ""
	s.journalTableName = "journal"
	return s
}

// Keep discovery inside the test while exercising real ES256 verification,
// OpenAPI authorization, account scopes, and the journal owner check.
func oidcAuthenticationTestRequest(t *testing.T, server, signer *Server, issuer, requestURL, host string, originForm bool) (*httptest.ResponseRecorder, []string) {
	t.Helper()
	token, err := signer.IssueJWT(t.Context(), jwt.Claims{
		Issuer: issuer, Subject: journalOwnerSubject, Audience: jwt.Audience{zemnMeClient},
		Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	if err != nil {
		t.Fatal(err)
	}
	var discoveries []string
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		origin := r.URL.Scheme + "://" + r.URL.Host
		discoveries = append(discoveries, origin)
		if origin != issuer {
			return nil, fmt.Errorf("unconfigured test issuer %s", origin)
		}
		var document any
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			document = map[string]any{"issuer": issuer, "jwks_uri": issuer + "/.well-known/jwks.json", "id_token_signing_alg_values_supported": []string{"ES256"}}
		case "/.well-known/jwks.json":
			document = signer.keySet()
		default:
			return nil, fmt.Errorf("unexpected discovery request %s", r.URL)
		}
		body, err := json.Marshal(document)
		if err != nil {
			return nil, err
		}
		return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
	})}
	r := httptest.NewRequest("GET", requestURL, nil).WithContext(oidc.ClientContext(t.Context(), client))
	r.Host = host
	if originForm {
		r.URL.Scheme, r.URL.Host = "", ""
	}
	r.Header.Set("Authorization", token)
	r.Header.Set("Forwarded", "host=untrusted.example;proto=https")
	r.Header.Set("X-Forwarded-Host", "untrusted.example")
	r.Header.Set("X-Forwarded-Proto", "https")
	response := httptest.NewRecorder()
	server.ServeHTTP(response, r)
	return response, discoveries
}

func TestOIDCRequestHostIssuerDisabledByDefault(t *testing.T) {
	t.Setenv("ZEMN_API_ORIGIN", "https://api.zemn.me")
	server := newOIDCAuthenticationTestServer(t, NewServerOptions{})
	untrusted := newOIDCAuthenticationTestServer(t, NewServerOptions{})
	for _, tc := range []struct {
		name, issuer, url, host string
		originForm              bool
	}{
		{"HTTPS host", "https://untrusted.example", "https://api.zemn.me/journal", "untrusted.example", false},
		{"HTTP host", "http://untrusted.example", "http://api.zemn.me/journal", "untrusted.example", false},
		{"TLS origin form", "https://untrusted.example", "https://api.zemn.me/journal", "untrusted.example", true},
		{"HTTP origin form", "http://untrusted.example", "http://api.zemn.me/journal", "untrusted.example", true},
		{"localhost host", "http://localhost", "http://localhost/journal", "localhost", false},
		{"IPv6 host", "http://[::1]", "http://[::1]/journal", "[::1]", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response, discoveries := oidcAuthenticationTestRequest(t, server, untrusted, tc.issuer, tc.url, tc.host, tc.originForm)
			if response.Code != 401 {
				t.Fatalf("request-derived issuer accepted: %d %s", response.Code, response.Body)
			}
			for _, origin := range discoveries {
				if origin == tc.issuer {
					t.Fatalf("request-derived issuer was contacted: %s", origin)
				}
			}
		})
	}
}

func TestOIDCConfiguredIssuerIgnoresRequestHost(t *testing.T) {
	for _, issuer := range []string{"https://api.zemn.me", "https://api.staging.zemn.me"} {
		t.Run(issuer, func(t *testing.T) {
			t.Setenv("ZEMN_API_ORIGIN", issuer)
			server := newOIDCAuthenticationTestServer(t, NewServerOptions{})
			response, discoveries := oidcAuthenticationTestRequest(t, server, server, issuer, issuer+"/journal", "untrusted.example", false)
			if response.Code != 200 {
				t.Fatalf("configured issuer rejected: %d %s", response.Code, response.Body)
			}
			for _, origin := range discoveries {
				if strings.Contains(origin, "untrusted.example") {
					t.Fatalf("request header selected an issuer: %s", origin)
				}
			}
		})
	}
}

func TestOIDCRequestHostIssuerAllowedOnlyOnConfiguredLocalServer(t *testing.T) {
	t.Setenv("ZEMN_API_ORIGIN", "https://api.zemn.me")
	local := newOIDCAuthenticationTestServer(t, NewServerOptions{AllowRequestHostOIDCIssuer: true})
	production := newOIDCAuthenticationTestServer(t, NewServerOptions{})
	for _, issuer := range []string{"http://localhost", "http://[::1]", "https://local.example"} {
		t.Run(issuer, func(t *testing.T) {
			// Constructing another server must neither enable its local policy
			// nor reset the first server's explicitly configured policy.
			for _, target := range []struct {
				server *Server
				status int
			}{{local, 200}, {production, 401}, {local, 200}} {
				host := strings.TrimPrefix(strings.TrimPrefix(issuer, "https://"), "http://")
				response, discoveries := oidcAuthenticationTestRequest(t, target.server, local, issuer, issuer+"/journal", host, true)
				if response.Code != target.status {
					t.Fatalf("status %d, want %d: %s", response.Code, target.status, response.Body)
				}
				if target.status == 401 {
					for _, origin := range discoveries {
						if origin == issuer {
							t.Fatalf("local issuer discovered by production server: %s", origin)
						}
					}
				}
			}
		})
	}
}
