package apiserver

import (
	"context"
	"crypto/subtle"
	"errors"
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
func (s *Server) oauthRegister(ctx context.Context, body MCPOAuthClient) (MCPOAuthClient, *oauthFailure) {
	client := oauthClient(body)
	if err := client.validate(); err != nil {
		return oauthFail[MCPOAuthClient](400, "invalid_client_metadata", err.Error())
	}
	client.ClientId = oauthRandom()
	if err := s.oauthPut(ctx, "client", client.ClientId, client, time.Time{}, ""); err != nil {
		return oauthFail[MCPOAuthClient](503, "temporarily_unavailable", "Registration unavailable")
	}
	return MCPOAuthClient(client), nil
}
func (s *Server) oauthAuthorize(ctx context.Context, q AuthorizeMCPClientParams) (string, *oauthFailure) {
	client, err := s.oauthResolveClient(ctx, q.ClientId)
	if err != nil || !slices.Contains(client.RedirectUris, q.RedirectUri) {
		return oauthFail[string](400, "invalid_request", "Unknown client or unregistered redirect URI")
	}
	if q.ResponseType != "code" || q.CodeChallengeMethod != "S256" || !oauthChallengeValid(q.CodeChallenge) {
		return oauthFail[string](400, "invalid_request", "Authorization code with S256 PKCE is required")
	}
	if q.Resource != oauthURL(journalMCPPath) {
		return oauthFail[string](400, "invalid_target", "The journal MCP resource is required")
	}
	if scope := q.Scope; scope != "" && scope != "journal_read" {
		return oauthFail[string](400, "invalid_scope", "Only journal_read is supported")
	}
	request := oauthAuthorization{Client: client, RedirectURI: q.RedirectUri, State: q.State, Challenge: q.CodeChallenge, Resource: q.Resource}
	id := oauthRandom()
	if err = s.oauthPut(ctx, "request", id, request, time.Now().Add(10*time.Minute), ""); err != nil {
		return oauthFail[string](503, "temporarily_unavailable", "Authorization unavailable")
	}
	return oauthFrontendOrigin() + "/journal/connect?request=" + url.QueryEscape(id), nil
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
func (s *Server) oauthConsent(ctx context.Context, id string, approve bool) (OAuthConsentResult, *oauthFailure) {
	var request oauthAuthorization
	previous, err := s.oauthGet(ctx, "request", id, &request)
	if err != nil {
		return oauthFail[OAuthConsentResult](400, "invalid_request", "This connection request has expired. Start again from your MCP client.")
	}
	info, _ := auth.UserInfoFromContext(ctx)
	if info == nil {
		return oauthFail[OAuthConsentResult](401, "access_denied", "Sign in to zemn.me first")
	}

	if err = s.oauthDelete(ctx, "request", id, previous); err != nil {
		return oauthFail[OAuthConsentResult](400, "invalid_request", "This request has already been used")
	}
	redirect, _ := url.Parse(request.RedirectURI)
	query := redirect.Query()
	query.Set("state", request.State)
	query.Set("iss", oauthURL(""))
	if approve {
		request.Subject = info.Subject
		code := oauthRandom()
		if err = s.oauthPut(ctx, "code", code, request, time.Now().Add(time.Minute), ""); err != nil {
			return oauthFail[OAuthConsentResult](503, "temporarily_unavailable", "Authorization unavailable")
		}
		query.Set("code", code)
	} else {
		query.Set("error", "access_denied")
	}
	redirect.RawQuery = query.Encode()
	return OAuthConsentResult{RedirectUri: redirect.String()}, nil
}
func (s *Server) oauthToken(ctx context.Context, f MCPOAuthTokenRequest) (MCPOAuthTokenResponse, *oauthFailure) {
	if f.Resource != oauthURL(journalMCPPath) {
		return oauthFail[MCPOAuthTokenResponse](400, "invalid_target", "The journal MCP resource is required")
	}
	if scope := f.Scope; scope != "" && scope != "journal_read" {
		return oauthFail[MCPOAuthTokenResponse](400, "invalid_scope", "Only journal_read is supported")
	}
	if f.ClientSecret != "" || protocolRequest(ctx).Header.Get("Authorization") != "" {
		return oauthFail[MCPOAuthTokenResponse](400, "invalid_client", "Public clients use PKCE without client secrets")
	}
	switch f.GrantType {
	case "authorization_code":
		var code oauthAuthorization
		previous, err := s.oauthGet(ctx, "code", f.Code, &code)
		verifier := f.CodeVerifier
		if err != nil || code.Client.ClientId != f.ClientId || code.RedirectURI != f.RedirectUri || code.Resource != f.Resource || !oauthVerifierValid(verifier) || subtle.ConstantTimeCompare([]byte(oauthHash(verifier)), []byte(code.Challenge)) != 1 {
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Invalid authorization code or PKCE verifier")
		}
		if !s.oauthSubjectAllowed(ctx, code.Subject) {
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Journal access is no longer available")
		}
		if err = s.oauthDelete(ctx, "code", f.Code, previous); err != nil {
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Authorization code already used")
		}
		lifetime := time.Hour
		refresh := slices.Contains(code.Client.GrantTypes, "refresh_token")
		if refresh {
			lifetime = 30 * 24 * time.Hour
		}
		grant := oauthGrant{Subject: code.Subject, ClientID: code.Client.ClientId, Expires: time.Now().Add(lifetime)}
		return s.oauthIssueTokens(ctx, oauthRandom(), grant, "", refresh)
	case "refresh_token":
		claims, err := s.oauthParseToken(f.RefreshToken, "refresh")
		if err != nil || claims.ClientID != f.ClientId {
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Invalid refresh token")
		}
		var grant oauthGrant
		previous, err := s.oauthGet(ctx, "grant", claims.Grant, &grant)
		if err != nil || grant.ClientID != claims.ClientID || !s.oauthSubjectAllowed(ctx, grant.Subject) {
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Authorization expired or revoked")
		}
		if subtle.ConstantTimeCompare([]byte(grant.RefreshHash), []byte(oauthHash(f.RefreshToken))) != 1 {
			// A correctly signed, previously rotated refresh token proves reuse.
			if err = s.oauthDelete(ctx, "grant", claims.Grant, ""); err != nil {
				return oauthFail[MCPOAuthTokenResponse](503, "temporarily_unavailable", "Revocation unavailable")
			}
			return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Refresh token reuse revoked this connection")
		}
		return s.oauthIssueTokens(ctx, claims.Grant, grant, previous, true)
	default:
		return oauthFail[MCPOAuthTokenResponse](400, "unsupported_grant_type", "Use authorization_code or refresh_token")
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
func (s *Server) oauthIssueTokens(ctx context.Context, id string, grant oauthGrant, previous string, refresh bool) (MCPOAuthTokenResponse, *oauthFailure) {
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
	access, err := s.IssueJWT(ctx, claims)
	var renewal string
	if err == nil && refresh {
		claims.Use = "refresh"
		claims.Expiry = jwt.NewNumericDate(grant.Expires)
		claims.ID = oauthRandom()
		renewal, err = s.IssueJWT(ctx, claims)
		grant.RefreshHash = oauthHash(renewal)
	}
	if err != nil {
		return oauthFail[MCPOAuthTokenResponse](503, "temporarily_unavailable", "Token signing unavailable")
	}
	if err = s.oauthPut(ctx, "grant", id, grant, grant.Expires, previous); err != nil {
		var conflict *types.ConditionalCheckFailedException
		if !errors.As(err, &conflict) {
			return oauthFail[MCPOAuthTokenResponse](503, "temporarily_unavailable", "Token storage unavailable")
		}
		// Concurrent use of the same refresh token is also reuse. Revoke the
		// winning rotation because we cannot distinguish the legitimate client.
		if previous != "" {
			if err = s.oauthDelete(ctx, "grant", id, ""); err != nil {
				return oauthFail[MCPOAuthTokenResponse](503, "temporarily_unavailable", "Revocation unavailable")
			}
		}
		return oauthFail[MCPOAuthTokenResponse](400, "invalid_grant", "Authorization was already used or revoked")
	}
	return MCPOAuthTokenResponse{AccessToken: access, TokenType: "Bearer", ExpiresIn: int(time.Until(accessExpiry) / time.Second), Scope: "journal_read", RefreshToken: renewal}, nil
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
func (s *Server) oauthRevoke(ctx context.Context, body MCPOAuthRevocation) (struct{}, *oauthFailure) {
	claims, err := s.oauthParseToken(body.Token, "refresh")
	if err != nil {
		claims, err = s.oauthParseToken(body.Token, "access")
	}
	if err == nil && claims.ClientID == body.ClientId {
		if err = s.oauthDelete(ctx, "grant", claims.Grant, ""); err != nil {
			return oauthFail[struct{}](503, "temporarily_unavailable", "Revocation unavailable")
		}
	}
	return struct{}{}, nil
}
