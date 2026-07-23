package auth

import (
	"slices"
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

func TestAllowableIssuerClientsIgnoresRequestHost(t *testing.T) {
	candidates := allowableIssuerClients("https://api.zemn.me")

	var issuers []string
	for _, candidate := range candidates {
		issuers = append(issuers, candidate.issuer)
	}

	if slices.Contains(issuers, "https://attacker.example") {
		t.Fatalf("request Host must not become an allowed issuer: %#v", candidates)
	}
	if !slices.Contains(issuers, "https://api.zemn.me") {
		t.Fatalf("expected scheme issuer to remain allowed: %#v", candidates)
	}
}
