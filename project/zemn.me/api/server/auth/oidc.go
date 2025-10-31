package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	oidc "github.com/coreos/go-oidc"

	"github.com/getkin/kin-openapi/openapi3filter"
)

type contextKey string

const SubjectKey contextKey = "oidc_subject"

// SubjectFromContext retrieves the subject ID from the context if present.
func SubjectFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(SubjectKey)
	s, ok := v.(string)
	return s, ok
}

// suuper basic oidc auth that only checks if it's me via Google.
func OIDC(ctx context.Context, ai *openapi3filter.AuthenticationInput) (err error) {
	// no requirement
	if ai.SecuritySchemeName != "zemnMeOIDC" {
		return nil
	}

	auth := ai.RequestValidationInput.Request.Header.Get("Authorization")
	if auth == "" {
		return errors.New("missing authorization header")
	}

	issuer, err := issuerFromToken(auth)
	if err != nil {
		return fmt.Errorf("extract issuer: %w", err)
	}

	provider, err := oidc.NewProvider(ctx, issuer)
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
