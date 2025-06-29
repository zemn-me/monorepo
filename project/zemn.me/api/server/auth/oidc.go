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

	var claims struct {
		Sub   string `json:"sub"`
		Iss   string `json:"iss"`
		Email string `json:"email"`
	}

	if err := token.Claims(&claims); err != nil {
		return fmt.Errorf("failed to parse claims: %w", err)
	}

	if claims.Iss != "https://accounts.google.com" {
		return fmt.Errorf("invalid issuer: %s", claims.Iss)
	}

        if claims.Sub != "111669004071516300752" &&
                claims.Sub != "112149295011396650000" {
                return fmt.Errorf("unauthorized subject: %s", claims.Sub)
        }

        r := ai.RequestValidationInput.Request
        ctx = context.WithValue(r.Context(), SubjectKey, claims.Sub)
        *ai.RequestValidationInput.Request = *r.WithContext(ctx)

        return nil
}
