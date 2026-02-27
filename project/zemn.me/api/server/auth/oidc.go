package auth

import (
	"context"
	"errors"
	"fmt"
	oidc "github.com/coreos/go-oidc"
	"net/http"
	"net/url"
	"os"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
)

type contextKey string

const IDTokenKey contextKey = "oidc_id_token"
const securitySchemeOIDC = "OIDC"
const (
	googleIssuer        = "https://accounts.google.com"
	googleClientID      = "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"
	zemnMeClientID      = "zemn.me"
	defaultTestClientID = "integration-test-client"
)

type issuerClient struct {
	issuer   string
	clientID string
}

type IDToken struct {
	Subject    string `json:"sub"`
	Issuer     string `json:"iss"`
	Email      string `json:"email"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
}

// UserInfoFromContext retrieves the OIDC ID token claims from the context if present.
func UserInfoFromContext(ctx context.Context) (*IDToken, bool) {
	v := ctx.Value(IDTokenKey)
	token, ok := v.(*IDToken)
	return token, ok
}

// ScopeResolver resolves scopes for a verified token subject.
var ScopeResolver func(ctx context.Context, issuer, subject string) ([]string, error)

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

	allowed := allowableIssuerClients(ai.RequestValidationInput.Request, issuerFromScheme)
	if len(allowed) == 0 {
		return errors.New("no allowable issuers configured")
	}

	var joined error
	for _, candidate := range allowed {
		provider, err := oidc.NewProvider(ctx, candidate.issuer)
		if err != nil {
			joined = errors.Join(joined, fmt.Errorf("issuer %s: create provider: %w", candidate.issuer, err))
			continue
		}

		verifier := provider.Verifier(&oidc.Config{ClientID: candidate.clientID})
		verifiedToken, err := verifier.Verify(ctx, auth)
		if err != nil {
			joined = errors.Join(joined, fmt.Errorf("issuer %s: verify token: %w", candidate.issuer, err))
			continue
		}

		if len(ai.Scopes) > 0 {
			if ScopeResolver == nil {
				joined = errors.Join(joined, fmt.Errorf("issuer %s: scope resolver not configured", candidate.issuer))
				continue
			}
			scopes, err := ScopeResolver(ctx, candidate.issuer, verifiedToken.Subject)
			if err != nil {
				joined = errors.Join(joined, fmt.Errorf("issuer %s: scope resolve: %w", candidate.issuer, err))
				continue
			}
			if err := requireScopeList(scopes, ai.Scopes); err != nil {
				joined = errors.Join(joined, fmt.Errorf("issuer %s: scope check: %w", candidate.issuer, err))
				continue
			}
		}

		r := ai.RequestValidationInput.Request
		idToken := &IDToken{
			Subject: verifiedToken.Subject,
			Issuer:  candidate.issuer,
		}
		if err := verifiedToken.Claims(idToken); err != nil {
			joined = errors.Join(joined, fmt.Errorf("issuer %s: decode claims: %w", candidate.issuer, err))
			continue
		}
		ctx = context.WithValue(r.Context(), IDTokenKey, idToken)
		*ai.RequestValidationInput.Request = *r.WithContext(ctx)
		return nil
	}

	if joined == nil {
		return errors.New("token verification failed for all configured issuers")
	}

	return joined
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
	issuer.Fragment = ""
	issuer.RawQuery = ""
	return issuer.String(), nil
}

func allowableIssuerClients(req *http.Request, schemeIssuer string) []issuerClient {
	seen := map[string]struct{}{}
	var candidates []issuerClient

	add := func(issuer, clientID string) {
		if issuer == "" || clientID == "" {
			return
		}
		key := issuer + "\x00" + clientID
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		candidates = append(candidates, issuerClient{
			issuer:   issuer,
			clientID: clientID,
		})
	}

	add(schemeIssuer, zemnMeClientID)

	if req != nil {
		scheme := "https"
		if req.URL != nil && req.URL.Scheme != "" {
			scheme = req.URL.Scheme
		} else if req.TLS == nil {
			scheme = "http"
		}
		if host := req.Host; host != "" {
			add(fmt.Sprintf("%s://%s", scheme, host), zemnMeClientID)
		}
	}

	if envIssuer := os.Getenv("ZEMN_TEST_OIDC_ISSUER"); envIssuer != "" {
		clientID := os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID")
		if clientID == "" {
			clientID = defaultTestClientID
		}
		add(envIssuer, clientID)
	}

	if envProvider := os.Getenv("ZEMN_TEST_OIDC_PROVIDER"); envProvider != "" {
		clientID := os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID")
		if clientID == "" {
			clientID = defaultTestClientID
		}
		add(envProvider, clientID)
	}

	add(googleIssuer, googleClientID)

	return candidates
}

func requireScopeList(available []string, required []string) error {
	if len(required) == 0 {
		return nil
	}

	seen := map[string]struct{}{}
	for _, s := range available {
		seen[s] = struct{}{}
	}
	for _, needed := range required {
		if _, ok := seen[needed]; !ok {
			return fmt.Errorf("missing required scope %q", needed)
		}
	}

	return nil
}
