// server for api.zemn.me
package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/coreos/go-oidc"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

// validateOIDCToken checks if the provided ID token is valid.
func validateOIDCToken(ctx context.Context, idToken string) error {
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	// todo: single source of truth for this.
	verifier := provider.Verifier(&oidc.Config{ClientID: "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"})

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

	if claims.Sub != "111669004071516300752" {
		return fmt.Errorf("unauthorized subject: %s", claims.Email)
	}

	return nil
}

// OIDCMiddleware verifies the Authorization header for a valid OIDC token.
func OIDCMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		// If the header is "Bearer <token>", extract the token.
		parts := strings.Split(authHeader, " ")
		var token string
		if len(parts) == 2 && parts[0] == "Bearer" {
			token = parts[1]
		} else {
			token = authHeader
		}

		if err := validateOIDCToken(r.Context(), token); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300, // Cache preflight response for 5 minutes
	}))

	// Apply the OIDC middleware to secure endpoints.
	r.Use(OIDCMiddleware)

	r.Get("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Post("/phone/init", TwilioErrorHandler(TwilioCallboxEntryPoint))
	r.Get("/phone/handleEntry", TwilioErrorHandler(TwilioCallboxProcessPhoneEntry))

	h := HandlerFromMux(Server{}, r)

	lambda.Start(httpadapter.New(h).ProxyWithContext)
}
