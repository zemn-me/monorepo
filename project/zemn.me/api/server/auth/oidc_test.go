package auth

import (
	"net/http/httptest"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestIssuerFromSecurityScheme_PreservesWellKnownPath(t *testing.T) {
	scheme := &openapi3.SecurityScheme{
		Type:             "openIdConnect",
		OpenIdConnectUrl: "https://idp.example/.well-known/openid-configuration",
	}

	got, err := issuerFromSecurityScheme(scheme)
	if err != nil {
		t.Fatalf("issuerFromSecurityScheme returned error: %v", err)
	}

	want := "https://idp.example/.well-known/openid-configuration"
	if got != want {
		t.Fatalf("issuer mismatch: want %q, got %q", want, got)
	}
}

func TestIssuerFromSecurityScheme_StripsQueryAndFragment(t *testing.T) {
	scheme := &openapi3.SecurityScheme{
		Type:             "openIdConnect",
		OpenIdConnectUrl: "https://issuer.example/.well-known/openid-configuration?foo=bar#frag",
	}

	got, err := issuerFromSecurityScheme(scheme)
	if err != nil {
		t.Fatalf("issuerFromSecurityScheme returned error: %v", err)
	}

	want := "https://issuer.example/.well-known/openid-configuration"
	if got != want {
		t.Fatalf("issuer mismatch: want %q, got %q", want, got)
	}
}

func TestAllowableIssuerClients_DoesNotIncludeGoogleFallback(t *testing.T) {
	req := httptest.NewRequest("GET", "https://api.zemn.me/callbox", nil)

	allowed := allowableIssuerClients(req, "https://api.zemn.me")

	for _, candidate := range allowed {
		if candidate.issuer == "https://accounts.google.com" {
			t.Fatalf("google issuer should not be allowed for endpoint auth: %+v", allowed)
		}
	}
}

func TestAllowableIssuerClients_UsesTestIssuerFromEnv(t *testing.T) {
	issuer := "http://localhost:43111"
	t.Setenv("ZEMN_TEST_OIDC_ISSUER", issuer)
	t.Setenv("ZEMN_TEST_OIDC_PROVIDER", "")
	t.Setenv("ZEMN_TEST_OIDC_CLIENT_ID", "")

	req := httptest.NewRequest("GET", "http://localhost:3000/callbox", nil)
	allowed := allowableIssuerClients(req, "https://api.zemn.me")

	found := false
	for _, candidate := range allowed {
		if candidate.issuer == issuer && candidate.clientID == defaultTestClientID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected test issuer with default client id in candidates: %+v", allowed)
	}
}

func TestAllowableIssuerClients_UsesExplicitTestClientID(t *testing.T) {
	issuer := "http://localhost:43111"
	clientID := "my-test-client"
	t.Setenv("ZEMN_TEST_OIDC_ISSUER", issuer)
	t.Setenv("ZEMN_TEST_OIDC_CLIENT_ID", clientID)

	req := httptest.NewRequest("GET", "http://localhost:3000/callbox", nil)
	allowed := allowableIssuerClients(req, "https://api.zemn.me")

	found := false
	for _, candidate := range allowed {
		if candidate.issuer == issuer && candidate.clientID == clientID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected test issuer with explicit client id in candidates: %+v", allowed)
	}
}

func TestAllowableIssuerClients_UsesProviderOverrideFromEnv(t *testing.T) {
	provider := "https://provider.example"
	t.Setenv("ZEMN_TEST_OIDC_PROVIDER", provider)
	t.Setenv("ZEMN_TEST_OIDC_CLIENT_ID", "")

	req := httptest.NewRequest("GET", "http://localhost:3000/callbox", nil)
	allowed := allowableIssuerClients(req, "https://api.zemn.me")

	found := false
	for _, candidate := range allowed {
		if candidate.issuer == provider && candidate.clientID == defaultTestClientID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected provider override with default client id in candidates: %+v", allowed)
	}
}
