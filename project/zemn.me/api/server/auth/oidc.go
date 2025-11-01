package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	oidc "github.com/coreos/go-oidc"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
)

type contextKey string

const SubjectKey contextKey = "oidc_subject"
const securitySchemeOIDC = "OIDC"

// SubjectFromContext retrieves the subject ID from the context if present.
func SubjectFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(SubjectKey)
	s, ok := v.(string)
	return s, ok
}

// suuper basic oidc auth that only checks if it's me via Google.
func OIDC(ctx context.Context, ai *openapi3filter.AuthenticationInput) (err error) {
	if ai.SecuritySchemeName != securitySchemeOIDC {
		return fmt.Errorf("unsupported security scheme %q", ai.SecuritySchemeName)
	}

	issuerFromScheme, err := issuerFromSecurityScheme(ai.SecurityScheme)
	if err != nil {
		return err
	}

	auth := ai.RequestValidationInput.Request.Header.Get("Authorization")
	if auth == "" {
		return errors.New("missing authorization header")
	}

	issuerFromToken, err := issuerFromToken(auth)
	if err != nil {
		return fmt.Errorf("extract issuer: %w", err)
	}

	if !issuerMatchesAllowed(ai.RequestValidationInput.Request, issuerFromToken, issuerFromScheme) {
		return fmt.Errorf("token issuer mismatch: got %s", issuerFromToken)
	}

	if err := ensureAllowedIssuer(ai.RequestValidationInput.Request, issuerFromToken); err != nil {
		return err
	}

	provider, err := oidc.NewProvider(ctx, issuerFromToken)
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: "zemn.me"})

	idToken := auth

	verified_token, err := verifier.Verify(ctx, idToken)
	if err != nil {
		return fmt.Errorf("token verification failed: %w", err)
	}

	r := ai.RequestValidationInput.Request
	ctx = context.WithValue(r.Context(), SubjectKey, verified_token.Subject)
	*ai.RequestValidationInput.Request = *r.WithContext(ctx)

	return nil
}

func issuerFromToken(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return "", errors.New("invalid token: not enough segments")
	}

	payload, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("decode token payload: %w", err)
	}

	var claims struct {
		Iss string `json:"iss"`
	}

	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", fmt.Errorf("unmarshal token payload: %w", err)
	}

	if claims.Iss == "" {
		return "", errors.New("token missing issuer")
	}

	return claims.Iss, nil
}

func issuerFromSecurityScheme(scheme *openapi3.SecurityScheme) (string, error) {
	if scheme == nil {
		return "", errors.New("missing OIDC security scheme definition")
	}
	if scheme.Type != "openIdConnect" {
		return "", fmt.Errorf("security scheme type %q is not openIdConnect", scheme.Type)
	}
	if scheme.OpenIdConnectUrl == "" {
		return "", errors.New("openIdConnectUrl is required")
	}
	parsed, err := url.Parse(scheme.OpenIdConnectUrl)
	if err != nil {
		return "", fmt.Errorf("parse openIdConnectUrl: %w", err)
	}
	issuer := parsed
	if strings.EqualFold(parsed.Path, "/.well-known/openid-configuration") {
		issuer = parsed.ResolveReference(&url.URL{Path: ""})
	}
	issuer.Fragment = ""
	issuer.RawQuery = ""
	return issuer.String(), nil
}

func issuerMatchesAllowed(req *http.Request, tokenIssuer, schemeIssuer string) bool {
	expected := map[string]struct{}{
		schemeIssuer: {},
	}
	if envIssuer := os.Getenv("ZEMN_TEST_OIDC_ISSUER"); envIssuer != "" {
		expected[envIssuer] = struct{}{}
	}
	if envProvider := os.Getenv("ZEMN_TEST_OIDC_PROVIDER"); envProvider != "" {
		expected[envProvider] = struct{}{}
	}
	if req != nil {
		scheme := "https"
		if req.URL != nil && req.URL.Scheme != "" {
			scheme = req.URL.Scheme
		} else if req.TLS == nil {
			scheme = "http"
		}
		host := req.Host
		if host != "" {
			expected[fmt.Sprintf("%s://%s", scheme, host)] = struct{}{}
		}
	}
	_, ok := expected[tokenIssuer]
	return ok
}

func ensureAllowedIssuer(req *http.Request, issuer string) error {
	allowed := map[string]struct{}{
		"https://accounts.google.com": {},
	}

	if test := os.Getenv("ZEMN_TEST_OIDC_ISSUER"); test != "" {
		allowed[test] = struct{}{}
	}

	if req != nil {
		scheme := "https"
		if req.URL != nil && req.URL.Scheme != "" {
			scheme = req.URL.Scheme
		} else if req.TLS == nil {
			scheme = "http"
		}
		host := req.Host
		if host != "" {
			allowed[fmt.Sprintf("%s://%s", scheme, host)] = struct{}{}
		}
	}

	if _, ok := allowed[issuer]; ok {
		return nil
	}

	return fmt.Errorf("issuer %q is not permitted", issuer)
}
