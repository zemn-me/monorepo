package apiserver

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
)

const oauthTokenPath = "/oauth2/mcp/token"
const oauthRequestPath = "/oauth2/requests/"
const oauthResourceMetadataPath = "/.well-known/oauth-protected-resource/journal/mcp"

type oauthAuthorization struct {
	Client      oauthClient `json:"client"`
	RedirectURI string      `json:"redirect_uri"`
	State       string      `json:"state"`
	Challenge   string      `json:"challenge"`
	Resource    string      `json:"resource"`
	Subject     string      `json:"subject,omitempty"`
}
type oauthGrant struct {
	ClientID    string    `json:"client_id"`
	Subject     string    `json:"subject"`
	RefreshHash string    `json:"refresh_hash"`
	Expires     time.Time `json:"expires"`
}
type oauthTokenClaims struct {
	jwt.Claims
	ClientID string `json:"client_id"`
	Grant    string `json:"grant"`
	Scope    string `json:"scope"`
	Use      string `json:"token_use"`
}

func oauthURL(path string) string {
	root, err := ApiRoot()
	if err != nil {
		return ""
	}
	root.Path = path
	return root.String()
}
func oauthFrontendOrigin() string {
	if origin := os.Getenv("OAUTH_FRONTEND_ORIGIN"); origin != "" {
		return origin
	}
	return "https://zemn.me"
}
func oauthJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func oauthError(w http.ResponseWriter, status int, code, description string) {
	oauthJSON(w, status, map[string]string{"error": code, "error_description": description})
}
func oauthDecode(w http.ResponseWriter, r *http.Request, value any) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		oauthError(w, 400, "invalid_request", "JSON body required")
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	if err := decoder.Decode(value); err != nil {
		oauthError(w, 400, "invalid_request", "Invalid JSON body")
		return false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		oauthError(w, 400, "invalid_request", "Only one JSON object is allowed")
		return false
	}
	return true
}

func (s *Server) withMCPOAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		handled := path == "/.well-known/oauth-authorization-server" || path == oauthResourceMetadataPath || path == "/.well-known/oauth-protected-resource" || path == "/oauth2/register" || path == "/oauth2/authorize" || path == oauthTokenPath || path == "/oauth2/mcp/revoke" || strings.HasPrefix(path, oauthRequestPath)
		if !handled {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// Consent uses the website's bearer credential and is restricted to its
		// origin. Public OAuth protocol endpoints also serve browser MCP clients.
		if strings.HasPrefix(path, oauthRequestPath) {
			origin := r.Header.Get("Origin")
			if origin != "" && origin != oauthFrontendOrigin() {
				oauthError(w, 403, "access_denied", "Origin not allowed")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", oauthFrontendOrigin())
			w.Header().Add("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		switch {
		case r.Method == http.MethodGet && (path == oauthResourceMetadataPath || path == "/.well-known/oauth-protected-resource"):
			oauthJSON(w, http.StatusOK, map[string]any{
				"resource":                 oauthURL(journalMCPPath),
				"authorization_servers":    []string{oauthURL("")},
				"scopes_supported":         []string{"journal_read"},
				"bearer_methods_supported": []string{"header"},
				"resource_name":            "Voice journal",
			})
		case r.Method == http.MethodGet && path == "/.well-known/oauth-authorization-server":
			oauthJSON(w, http.StatusOK, map[string]any{
				"issuer":                                         oauthURL(""),
				"authorization_endpoint":                         oauthURL("/oauth2/authorize"),
				"token_endpoint":                                 oauthURL(oauthTokenPath),
				"registration_endpoint":                          oauthURL("/oauth2/register"),
				"revocation_endpoint":                            oauthURL("/oauth2/mcp/revoke"),
				"response_types_supported":                       []string{"code"},
				"grant_types_supported":                          []string{"authorization_code", "refresh_token"},
				"token_endpoint_auth_methods_supported":          []string{"none"},
				"revocation_endpoint_auth_methods_supported":     []string{"none"},
				"code_challenge_methods_supported":               []string{"S256"},
				"scopes_supported":                               []string{"journal_read"},
				"client_id_metadata_document_supported":          true,
				"authorization_response_iss_parameter_supported": true,
			})
		case r.Method == http.MethodPost && path == "/oauth2/register":
			s.oauthRegister(w, r)
		case r.Method == http.MethodGet && path == "/oauth2/authorize":
			s.oauthAuthorize(w, r)
		case (r.Method == http.MethodGet || r.Method == http.MethodPost) && strings.HasPrefix(path, oauthRequestPath):
			s.oauthConsent(w, r)
		case r.Method == http.MethodPost && path == oauthTokenPath:
			s.oauthToken(w, r)
		case r.Method == http.MethodPost && path == "/oauth2/mcp/revoke":
			s.oauthRevoke(w, r)
		default:
			oauthError(w, 405, "invalid_request", "Method not allowed")
		}
	})
}
func (s *Server) oauthRegister(w http.ResponseWriter, r *http.Request) {
	var client oauthClient
	if !oauthDecode(w, r, &client) {
		return
	}
	if err := client.validate(); err != nil {
		oauthError(w, 400, "invalid_client_metadata", err.Error())
		return
	}
	client.ID = oauthRandom()
	if err := s.oauthPut(r.Context(), "client", client.ID, client, time.Time{}, ""); err != nil {
		oauthError(w, 503, "temporarily_unavailable", "Registration unavailable")
		return
	}
	oauthJSON(w, 201, client)
}
func (s *Server) oauthAuthorize(w http.ResponseWriter, r *http.Request) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(r.URL.RawQuery) > 8192 {
		oauthError(w, 400, "invalid_request", "Invalid authorization request")
		return
	}
	for _, values := range q {
		if len(values) != 1 {
			oauthError(w, 400, "invalid_request", "Repeated parameters are not supported")
			return
		}
	}
	client, err := s.oauthResolveClient(r.Context(), q.Get("client_id"))
	if err != nil || !slices.Contains(client.RedirectURIs, q.Get("redirect_uri")) {
		oauthError(w, 400, "invalid_request", "Unknown client or unregistered redirect URI")
		return
	}
	if q.Get("response_type") != "code" || q.Get("code_challenge_method") != "S256" || !oauthChallengeValid(q.Get("code_challenge")) {
		oauthError(w, 400, "invalid_request", "Authorization code with S256 PKCE is required")
		return
	}
	if q.Get("resource") != oauthURL(journalMCPPath) {
		oauthError(w, 400, "invalid_target", "The journal MCP resource is required")
		return
	}
	if scope := q.Get("scope"); scope != "" && scope != "journal_read" {
		oauthError(w, 400, "invalid_scope", "Only journal_read is supported")
		return
	}
	request := oauthAuthorization{Client: client, RedirectURI: q.Get("redirect_uri"), State: q.Get("state"), Challenge: q.Get("code_challenge"), Resource: q.Get("resource")}
	id := oauthRandom()
	if err = s.oauthPut(r.Context(), "request", id, request, time.Now().Add(10*time.Minute), ""); err != nil {
		oauthError(w, 503, "temporarily_unavailable", "Authorization unavailable")
		return
	}
	http.Redirect(w, r, oauthFrontendOrigin()+"/journal/connect?request="+url.QueryEscape(id), http.StatusFound)
}
func oauthChallengeValid(s string) bool {
	if len(s) != 43 {
		return false
	}
	for _, c := range s {
		if !strings.ContainsRune("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", c) {
			return false
		}
	}
	return true
}
func (s *Server) oauthConsent(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, oauthRequestPath)
	var request oauthAuthorization
	previous, err := s.oauthGet(r.Context(), "request", id, &request)
	if err != nil {
		oauthError(w, 400, "invalid_request", "This connection request has expired. Start again from your MCP client.")
		return
	}
	if r.Method == http.MethodGet {
		oauthJSON(w, 200, map[string]any{"client_name": request.Client.Name, "client_id": request.Client.ID, "redirect_uri": request.RedirectURI, "scope": "journal_read"})
		return
	}
	var decision struct {
		Approve *bool `json:"approve"`
	}
	if !oauthDecode(w, r, &decision) {
		return
	}
	if decision.Approve == nil {
		oauthError(w, 400, "invalid_request", "An explicit consent decision is required")
		return
	}
	scheme, identity, _ := strings.Cut(r.Header.Get("Authorization"), " ")
	if !strings.EqualFold(scheme, "Bearer") {
		oauthError(w, 401, "access_denied", "Sign in to zemn.me first")
		return
	}
	info, err := s.verifyJournalIdentity(r.Context(), identity, r)
	if err != nil {
		oauthError(w, 401, "access_denied", "Sign in to zemn.me first")
		return
	}
	if !s.oauthSubjectAllowed(r.Context(), info.UserID) {
		oauthError(w, 403, "access_denied", "This account does not have journal access")
		return
	}
	if err = s.oauthDelete(r.Context(), "request", id, previous); err != nil {
		oauthError(w, 400, "invalid_request", "This request has already been used")
		return
	}
	redirect, _ := url.Parse(request.RedirectURI)
	query := redirect.Query()
	query.Set("state", request.State)
	query.Set("iss", oauthURL(""))
	if *decision.Approve {
		request.Subject = info.UserID
		code := oauthRandom()
		if err = s.oauthPut(r.Context(), "code", code, request, time.Now().Add(time.Minute), ""); err != nil {
			oauthError(w, 503, "temporarily_unavailable", "Authorization unavailable")
			return
		}
		query.Set("code", code)
	} else {
		query.Set("error", "access_denied")
	}
	redirect.RawQuery = query.Encode()
	oauthJSON(w, 200, map[string]string{"redirect_uri": redirect.String()})
}
func oauthForm(w http.ResponseWriter, r *http.Request) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/x-www-form-urlencoded" {
		oauthError(w, 400, "invalid_request", "Form body required")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16384)
	if err := r.ParseForm(); err != nil {
		oauthError(w, 400, "invalid_request", "Invalid form")
		return false
	}
	for _, values := range r.PostForm {
		if len(values) != 1 {
			oauthError(w, 400, "invalid_request", "Repeated parameters are not supported")
			return false
		}
	}
	return true
}
func (s *Server) oauthToken(w http.ResponseWriter, r *http.Request) {
	if !oauthForm(w, r) {
		return
	}
	f := r.PostForm
	if f.Get("resource") != oauthURL(journalMCPPath) {
		oauthError(w, 400, "invalid_target", "The journal MCP resource is required")
		return
	}
	if scope := f.Get("scope"); scope != "" && scope != "journal_read" {
		oauthError(w, 400, "invalid_scope", "Only journal_read is supported")
		return
	}
	if f.Get("client_secret") != "" || r.Header.Get("Authorization") != "" {
		oauthError(w, 400, "invalid_client", "Public clients use PKCE without client secrets")
		return
	}
	switch f.Get("grant_type") {
	case "authorization_code":
		var code oauthAuthorization
		previous, err := s.oauthGet(r.Context(), "code", f.Get("code"), &code)
		verifier := f.Get("code_verifier")
		if err != nil || code.Client.ID != f.Get("client_id") || code.RedirectURI != f.Get("redirect_uri") || code.Resource != f.Get("resource") || !oauthVerifierValid(verifier) || subtle.ConstantTimeCompare([]byte(oauthHash(verifier)), []byte(code.Challenge)) != 1 {
			oauthError(w, 400, "invalid_grant", "Invalid authorization code or PKCE verifier")
			return
		}
		if !s.oauthSubjectAllowed(r.Context(), code.Subject) {
			oauthError(w, 400, "invalid_grant", "Journal access is no longer available")
			return
		}
		if err = s.oauthDelete(r.Context(), "code", f.Get("code"), previous); err != nil {
			oauthError(w, 400, "invalid_grant", "Authorization code already used")
			return
		}
		lifetime := time.Hour
		refresh := slices.Contains(code.Client.GrantTypes, "refresh_token")
		if refresh {
			lifetime = 30 * 24 * time.Hour
		}
		grant := oauthGrant{Subject: code.Subject, ClientID: code.Client.ID, Expires: time.Now().Add(lifetime)}
		s.oauthIssueTokens(w, r, oauthRandom(), grant, "", refresh)
	case "refresh_token":
		claims, err := s.oauthParseToken(f.Get("refresh_token"), "refresh")
		if err != nil || claims.ClientID != f.Get("client_id") {
			oauthError(w, 400, "invalid_grant", "Invalid refresh token")
			return
		}
		var grant oauthGrant
		previous, err := s.oauthGet(r.Context(), "grant", claims.Grant, &grant)
		if err != nil || grant.ClientID != claims.ClientID || !s.oauthSubjectAllowed(r.Context(), grant.Subject) {
			oauthError(w, 400, "invalid_grant", "Authorization expired or revoked")
			return
		}
		if subtle.ConstantTimeCompare([]byte(grant.RefreshHash), []byte(oauthHash(f.Get("refresh_token")))) != 1 {
			// A correctly signed, previously rotated refresh token proves reuse.
			if err = s.oauthDelete(r.Context(), "grant", claims.Grant, ""); err != nil {
				oauthError(w, 503, "temporarily_unavailable", "Revocation unavailable")
				return
			}
			oauthError(w, 400, "invalid_grant", "Refresh token reuse revoked this connection")
			return
		}
		s.oauthIssueTokens(w, r, claims.Grant, grant, previous, true)
	default:
		oauthError(w, 400, "unsupported_grant_type", "Use authorization_code or refresh_token")
	}
}
func oauthVerifierValid(value string) bool {
	if len(value) < 43 || len(value) > 128 {
		return false
	}
	for _, c := range value {
		if !strings.ContainsRune("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~", c) {
			return false
		}
	}
	return true
}
func (s *Server) oauthSubjectAllowed(ctx context.Context, subject string) bool {
	scopes, err := s.resolveScopes(ctx, oauthURL(""), subject)
	_, ownerErr := journalSubject(context.WithValue(ctx, auth.IDTokenKey, &auth.IDToken{Subject: subject}))
	return err == nil && ownerErr == nil && slices.Contains(scopes, "journal_read")
}
func (s *Server) oauthIssueTokens(w http.ResponseWriter, r *http.Request, id string, grant oauthGrant, previous string, refresh bool) {
	now := time.Now()
	accessExpiry := now.Add(time.Hour)
	if grant.Expires.Before(accessExpiry) {
		accessExpiry = grant.Expires
	}
	claims := oauthTokenClaims{
		Claims: jwt.Claims{
			Issuer: oauthURL(""), Subject: grant.Subject,
			Audience: jwt.Audience{oauthURL(journalMCPPath)},
			IssuedAt: jwt.NewNumericDate(now), Expiry: jwt.NewNumericDate(accessExpiry),
			ID: oauthRandom(),
		},
		ClientID: grant.ClientID, Grant: id, Scope: "journal_read", Use: "access",
	}
	access, err := s.IssueJWT(r.Context(), claims)
	var renewal string
	if err == nil && refresh {
		claims.Use = "refresh"
		claims.Expiry = jwt.NewNumericDate(grant.Expires)
		claims.ID = oauthRandom()
		renewal, err = s.IssueJWT(r.Context(), claims)
		grant.RefreshHash = oauthHash(renewal)
	}
	if err != nil {
		oauthError(w, 503, "temporarily_unavailable", "Token signing unavailable")
		return
	}
	if err = s.oauthPut(r.Context(), "grant", id, grant, grant.Expires, previous); err != nil {
		var conflict *types.ConditionalCheckFailedException
		if !errors.As(err, &conflict) {
			oauthError(w, 503, "temporarily_unavailable", "Token storage unavailable")
			return
		}
		// Concurrent use of the same refresh token is also reuse. Revoke the
		// winning rotation because we cannot distinguish the legitimate client.
		if previous != "" {
			if err = s.oauthDelete(r.Context(), "grant", id, ""); err != nil {
				oauthError(w, 503, "temporarily_unavailable", "Revocation unavailable")
				return
			}
		}
		oauthError(w, 400, "invalid_grant", "Authorization was already used or revoked")
		return
	}
	response := map[string]any{"access_token": access, "token_type": "Bearer", "expires_in": int(time.Until(accessExpiry) / time.Second), "scope": "journal_read"}
	if refresh {
		response["refresh_token"] = renewal
	}
	oauthJSON(w, 200, response)
}
func (s *Server) oauthParseToken(raw, use string) (oauthTokenClaims, error) {
	var claims oauthTokenClaims
	token, err := jwt.ParseSigned(raw, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return claims, err
	}
	if err = token.Claims(s.keySet().Keys[0].Key, &claims); err != nil {
		return claims, err
	}
	if claims.Use != use || claims.Grant == "" || claims.Scope != "journal_read" || claims.Expiry == nil || claims.Subject == "" || claims.ValidateWithLeeway(jwt.Expected{Issuer: oauthURL(""), AnyAudience: jwt.Audience{oauthURL(journalMCPPath)}, Time: time.Now()}, 0) != nil {
		return claims, errors.New("invalid OAuth token")
	}
	return claims, nil
}
func (s *Server) verifyJournalMCPToken(ctx context.Context, raw string, _ *http.Request) (*mcpauth.TokenInfo, error) {
	claims, err := s.oauthParseToken(raw, "access")
	if err != nil {
		return nil, mcpauth.ErrInvalidToken
	}
	var grant oauthGrant
	if _, err = s.oauthGet(ctx, "grant", claims.Grant, &grant); err != nil || grant.ClientID != claims.ClientID || grant.Subject != claims.Subject {
		return nil, mcpauth.ErrInvalidToken
	}
	scopes := []string{}
	if s.oauthSubjectAllowed(ctx, claims.Subject) {
		scopes = []string{"journal_read"}
	}
	return &mcpauth.TokenInfo{UserID: claims.Subject, Scopes: scopes, Expiration: claims.Expiry.Time()}, nil
}
func (s *Server) oauthRevoke(w http.ResponseWriter, r *http.Request) {
	if !oauthForm(w, r) {
		return
	}
	claims, err := s.oauthParseToken(r.PostForm.Get("token"), "refresh")
	if err != nil {
		claims, err = s.oauthParseToken(r.PostForm.Get("token"), "access")
	}
	if err == nil && claims.ClientID == r.PostForm.Get("client_id") {
		if err = s.oauthDelete(r.Context(), "grant", claims.Grant, ""); err != nil {
			oauthError(w, 503, "temporarily_unavailable", "Revocation unavailable")
			return
		}
	}
	w.WriteHeader(200)
}
