package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/getkin/kin-openapi/openapi3filter"
	middleware "github.com/oapi-codegen/nethttp-middleware"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

type protocolRequestKey struct{}

func protocolRequest(ctx context.Context) *http.Request {
	return ctx.Value(protocolRequestKey{}).(*http.Request)
}
func isOAuthPath(path string) bool {
	return strings.HasPrefix(path, "/oauth2/") && path != "/oauth2/token" || strings.HasPrefix(path, "/.well-known/oauth-")
}

// This middleware only supplies HTTP context, limits and framing safeguards.
// All endpoint dispatch, schema validation and binding use the generated router.
func protocolHTTPContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isMCP := r.URL.Path == journalMCPPath
		if !isMCP && !isOAuthPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, oauthRequestPath) {
			if origin := r.Header.Get("Origin"); origin != "" && origin != oauthFrontendOrigin() {
				_, failure := oauthFail[struct{}](403, "access_denied", "Origin not allowed")
				_ = failure.write(w)
				return
			}
		}
		limit := int64(16384)
		if isMCP {
			limit = 64 * 1024
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		// Scalar OAuth fields may not be repeated. Keep the original bytes for the
		// OpenAPI validator and generated binder instead of normalizing the input.
		values, err := url.ParseQuery(r.URL.RawQuery)
		if !isMCP && (err != nil || len(r.URL.RawQuery) > 8192 || repeatedValues(values)) {
			protocolValidationError(r.Context(), errors.New("invalid query parameters"), w, r, middleware.ErrorHandlerOpts{StatusCode: 400})
			return
		}
		if !isMCP && r.Method == http.MethodPost {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				protocolValidationError(r.Context(), err, w, r, middleware.ErrorHandlerOpts{StatusCode: 400})
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))
			switch strings.Split(r.Header.Get("Content-Type"), ";")[0] {
			case "application/x-www-form-urlencoded":
				values, err := url.ParseQuery(string(body))
				if err != nil || repeatedValues(values) {
					protocolValidationError(r.Context(), errors.New("invalid form"), w, r, middleware.ErrorHandlerOpts{StatusCode: 400})
					return
				}
			case "application/json":
				if !json.Valid(body) {
					protocolValidationError(r.Context(), errors.New("invalid JSON"), w, r, middleware.ErrorHandlerOpts{StatusCode: 400})
					return
				}
			}
		}
		ctx := context.WithValue(r.Context(), protocolRequestKey{}, r)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func repeatedValues(values url.Values) bool {
	for _, v := range values {
		if len(v) != 1 {
			return true
		}
	}
	return false
}

func (s *Server) authenticateAPI(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	scheme := input.SecuritySchemeName
	if scheme != "JournalMCPBearer" && scheme != "JournalConsentBearer" {
		return auth.OIDC(ctx, input)
	}
	r := input.RequestValidationInput.Request
	header, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
	if !strings.EqualFold(header, "Bearer") {
		_, failure := oauthFail[struct{}](401, "invalid_token", "A bearer token is required")
		return failure
	}
	verifier := s.verifyJournalMCPToken
	if scheme == "JournalConsentBearer" {
		verifier = s.verifyJournalIdentity
	}
	info, err := verifier(ctx, token, r)
	if err != nil {
		_, failure := oauthFail[struct{}](401, "invalid_token", "Invalid or expired bearer token")
		return failure
	}
	if !slices.Contains(info.Scopes, "journal_read") {
		_, failure := oauthFail[struct{}](403, "insufficient_scope", "This account does not have journal access")
		return failure
	}
	ctx = context.WithValue(r.Context(), auth.IDTokenKey, &auth.IDToken{Subject: info.UserID})
	if _, err := journalSubject(ctx); err != nil {
		_, failure := oauthFail[struct{}](403, "insufficient_scope", "This account does not have journal access")
		return failure
	}
	*r = *r.WithContext(ctx)
	return nil
}
func protocolValidationError(ctx context.Context, err error, w http.ResponseWriter, r *http.Request, opts middleware.ErrorHandlerOpts) {
	if r.URL.Path != journalMCPPath && !isOAuthPath(r.URL.Path) {
		http.Error(w, err.Error(), opts.StatusCode)
		return
	}
	status := opts.StatusCode
	var failure *oauthFailure
	if !errors.As(err, &failure) {
		_, failure = oauthFail[struct{}](400, "invalid_request", "Request does not match the API schema")
	}
	if failure.status != 400 {
		status = failure.status
	} else if status < 400 {
		status = 400
	}
	failure.status = status
	if r.URL.Path == journalMCPPath {
		if status == 401 || status == 403 {
			w.Header().Set("WWW-Authenticate", fmt.Sprintf(`Bearer error=%q, resource_metadata=%q, scope="journal_read"`, failure.body.Error, oauthURL(oauthResourceMetadataPath)))
		}
		http.Error(w, http.StatusText(status), status)
		return
	}
	_ = failure.write(w)
}
