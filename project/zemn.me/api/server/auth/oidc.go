package auth

import (
	"context"
	"errors"
	"fmt"
	"slices"

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
	if ai.SecuritySchemeName != "googleOIDC" {
		return nil
	}

	auth := ai.RequestValidationInput.Request.Header.Get("Authorization")
	if auth == "" {
		return errors.New("missing authorization header")
	}

	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	// todo: single source of truth for this.
	verifier := provider.Verifier(&oidc.Config{ClientID: "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"})

	idToken := auth

	token, err := verifier.Verify(ctx, idToken)
	if err != nil {
		return fmt.Errorf("token verification failed: %w", err)
	}

	claim := Identity{
		Issuer:  token.Issuer,
		Subject: token.Subject,
	}

	idIdx := slices.IndexFunc(AuthorizedUsers, func(u Identity) bool {
		return u.Is(claim)
	})

	if idIdx < 0 {
		return fmt.Errorf("unauthorized user: %v", claim)
	}

	id := AuthorizedUsers[idIdx]

	r := ai.RequestValidationInput.Request
	ctx = context.WithValue(r.Context(), SubjectKey, id.Subject)
	*ai.RequestValidationInput.Request = *r.WithContext(ctx)

	return nil
}
