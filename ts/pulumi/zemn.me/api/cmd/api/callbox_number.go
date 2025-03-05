package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/coreos/go-oidc"
)

// ValidateOIDCToken checks if the provided ID token is valid.
func validateOIDCToken(ctx context.Context, idToken string) error {
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: ""})

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

	if claims.Email != "thomas@shadwell.im" {
		return fmt.Errorf("unauthorized subject: %s", claims.Email)
	}

	return nil
}

type CallboxNumberResponse struct {
	PhoneNumber string `json:"phoneNumber"`
}

func CallboxNumberHandler(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := validateOIDCToken(r.Context(), auth); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	response := CallboxNumberResponse{PhoneNumber: os.Getenv("CALLBOX_PHONE_NUMBER")}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
