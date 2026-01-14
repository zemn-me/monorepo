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
	"github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

type contextKey string

const SubjectKey contextKey = "oidc_subject"
const ClaimsKey contextKey = "oidc_claims"
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

// SubjectFromContext retrieves the subject ID from the context if present.
func SubjectFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(SubjectKey)
	s, ok := v.(string)
	return s, ok
}

// IdTokenFromContext retrieves the verified ID token claims from the context if present.
func IdTokenFromContext(ctx context.Context) (*types.IdToken, bool) {
	v := ctx.Value(ClaimsKey)
	claims, ok := v.(*types.IdToken)
	return claims, ok
}

// WithIdToken returns a new context with the ID token claims attached.
func WithIdToken(ctx context.Context, claims types.IdToken) context.Context {
	return context.WithValue(ctx, ClaimsKey, &claims)
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

		var claims types.IdToken
		_ = verifiedToken.Claims(&claims)

		r := ai.RequestValidationInput.Request
		ctx = context.WithValue(r.Context(), SubjectKey, verifiedToken.Subject)
		ctx = context.WithValue(ctx, ClaimsKey, &claims)
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
