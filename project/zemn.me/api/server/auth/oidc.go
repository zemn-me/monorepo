package auth

import (
	"context"
	"errors"
	"fmt"

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

	provider, err := oidc.NewProvider(ctx, "https://api.zemn.me")
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	// todo: single source of truth for this.
	verifier := provider.Verifier(&oidc.Config{ClientID: "this isn't needed"})

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
