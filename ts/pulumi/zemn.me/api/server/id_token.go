package apiserver

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/coreos/go-oidc"
)

type HTTPErrorCoder interface {
	error
	HTTPErrorCode() int
}

type HTTPError struct {
	Cause error
	Code  int
}

var _ HTTPErrorCoder = HTTPError{}

func (e HTTPError) Error() (s string) {
	return e.Cause.Error()
}

func (e HTTPError) HTTPErrorCode() int {
	return e.Code
}

func (e HTTPError) Unwrap() error {
	return e.Cause
}

func useOIDCAuth(rw http.ResponseWriter, rq *http.Request) error {
	auth := rq.Header.Get("Authorization")
	if auth == "" {
		return HTTPError{
			Cause: errors.New("missing authorization header"),
			Code:  http.StatusUnauthorized,
		}
	}

	idToken := auth

	provider, err := oidc.NewProvider(rq.Context(), "https://accounts.google.com")
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	// todo: single source of truth for this.
	verifier := provider.Verifier(&oidc.Config{ClientID: "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"})

	token, err := verifier.Verify(rq.Context(), idToken)
	if err != nil {
		return HTTPError{
			Cause: fmt.Errorf("token verification failed: %w", err),
			Code:  http.StatusUnauthorized,
		}
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
		return HTTPError{
			Cause: fmt.Errorf("invalid issuer: %s", claims.Iss),
			Code:  http.StatusUnauthorized,
		}
	}

	if claims.Sub != "111669004071516300752" {
		return HTTPError{
			Cause: fmt.Errorf("unauthorized subject: %s", claims.Email),
			Code:  http.StatusUnauthorized,
		}
	}

	return nil
}
