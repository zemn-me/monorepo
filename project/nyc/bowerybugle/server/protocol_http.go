package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/go-chi/chi/v5"
	middleware "github.com/oapi-codegen/nethttp-middleware"
)

var _ StrictServerInterface = (*Server)(nil)

type apiError struct {
	status  int
	message string
}

func (e apiError) Error() string { return e.message }
func responseError(w http.ResponseWriter, _ *http.Request, err error) {
	var expected apiError
	if errors.As(err, &expected) {
		problem(w, expected.status, expected.message)
		return
	}
	failure(w, err)
}
func invalidRequest(w http.ResponseWriter, _ *http.Request, _ error) {
	problem(w, http.StatusBadRequest, "Invalid request.")
}

type protocolRequestKey struct{}

func protocolRequest(ctx context.Context) *http.Request {
	return ctx.Value(protocolRequestKey{}).(*http.Request)
}

// Only framing and HTTP context live here; the spec controls binding, validation,
// routing and which operations require the author session.
func protocolHTTPContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 4096))
			if err != nil || len(body) > 0 && !json.Valid(body) {
				invalidRequest(w, r, err)
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), protocolRequestKey{}, r)))
	})
}
func (s *Server) authenticateAPI(_ context.Context, input *openapi3filter.AuthenticationInput) error {
	if input.SecuritySchemeName != "AuthorSession" {
		return apiError{401, "Please log in again."}
	}
	ok, err := s.authenticated(input.RequestValidationInput.Request)
	if err != nil {
		slog.Error("session lookup failed", "error", err)
		return apiError{503, "Something went wrong. Please try again."}
	}
	if !ok {
		return apiError{401, "Please log in again."}
	}
	return nil
}
func (s *Server) apiHandler() http.Handler {
	spec, err := GetSwagger()
	if err != nil {
		panic(err)
	}
	// Deployment hosts document the API, but tests and local development use their
	// own origins. CORS and mutation-origin checks are enforced by Handler.
	spec.Servers = nil
	router := chi.NewRouter()
	router.Use(protocolHTTPContext)
	router.Use(middleware.OapiRequestValidatorWithOptions(spec, &middleware.Options{
		Options: openapi3filter.Options{AuthenticationFunc: s.authenticateAPI},
		ErrorHandlerWithOpts: func(_ context.Context, err error, w http.ResponseWriter, r *http.Request, options middleware.ErrorHandlerOpts) {
			var expected apiError
			if errors.As(err, &expected) {
				responseError(w, r, expected)
				return
			}
			// Validation errors can contain the submitted login code. Keep their details
			// out of both responses and logs.
			problem(w, options.StatusCode, "Invalid request.")
		},
	}))
	router.NotFound(func(w http.ResponseWriter, r *http.Request) { problem(w, 404, "Not found.") })
	router.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) { problem(w, 405, "Method not allowed.") })
	return HandlerWithOptions(NewStrictHandlerWithOptions(s, nil, StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  invalidRequest,
		ResponseErrorHandlerFunc: responseError,
	}), ChiServerOptions{BaseRouter: router, ErrorHandlerFunc: invalidRequest})
}
