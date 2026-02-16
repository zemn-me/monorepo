package auth

import (
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
