package apiserver

import (
	"context"
	"encoding/json"
	"net/http"
)

// OAuth failures share a wire schema across generated operation interfaces.
// Successes use each operation's generated response and headers directly.
type oauthFailure struct {
	status int
	body   MCPOAuthError
}

func (f *oauthFailure) Error() string { return f.body.ErrorDescription }
func oauthFail[T any](status int, code, description string) (T, *oauthFailure) {
	var zero T
	return zero, &oauthFailure{status: status, body: MCPOAuthError{Error: code, ErrorDescription: description}}
}
func (f *oauthFailure) write(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(f.status)
	return json.NewEncoder(w).Encode(f.body)
}
func (s *Server) RegisterMCPClient(ctx context.Context, request RegisterMCPClientRequestObject) (RegisterMCPClientResponseObject, error) {
	result, failure := s.oauthRegister(ctx, *request.Body)
	if failure != nil {
		return failure, nil
	}
	return RegisterMCPClient201JSONResponse(result), nil
}
func (s *Server) AuthorizeMCPClient(ctx context.Context, request AuthorizeMCPClientRequestObject) (AuthorizeMCPClientResponseObject, error) {
	location, failure := s.oauthAuthorize(ctx, request.Params)
	if failure != nil {
		return failure, nil
	}
	return AuthorizeMCPClient302Response{Headers: AuthorizeMCPClient302ResponseHeaders{Location: location}}, nil
}
func (s *Server) GetMCPConsent(ctx context.Context, request GetMCPConsentRequestObject) (GetMCPConsentResponseObject, error) {
	var pending oauthAuthorization
	if _, err := s.oauthGet(ctx, "request", request.RequestId, &pending); err != nil {
		_, failure := oauthFail[struct{}](400, "invalid_request", "This connection request has expired. Start again from your MCP client.")
		return failure, nil
	}
	return GetMCPConsent200JSONResponse{ClientId: pending.Client.ClientId, ClientName: pending.Client.ClientName, RedirectUri: pending.RedirectURI, Scope: "journal_read"}, nil
}
func (s *Server) DecideMCPConsent(ctx context.Context, request DecideMCPConsentRequestObject) (DecideMCPConsentResponseObject, error) {
	result, failure := s.oauthConsent(ctx, request.RequestId, request.Body.Approve)
	if failure != nil {
		return failure, nil
	}
	return DecideMCPConsent200JSONResponse(result), nil
}
func (s *Server) ExchangeMCPToken(ctx context.Context, request ExchangeMCPTokenRequestObject) (ExchangeMCPTokenResponseObject, error) {
	result, failure := s.oauthToken(ctx, *request.Body)
	if failure != nil {
		return failure, nil
	}
	return ExchangeMCPToken200JSONResponse(result), nil
}
func (s *Server) RevokeMCPToken(ctx context.Context, request RevokeMCPTokenRequestObject) (RevokeMCPTokenResponseObject, error) {
	_, failure := s.oauthRevoke(ctx, *request.Body)
	if failure != nil {
		return failure, nil
	}
	return RevokeMCPToken200Response{}, nil
}
func (s *Server) GetMCPAuthorizationMetadata(context.Context, GetMCPAuthorizationMetadataRequestObject) (GetMCPAuthorizationMetadataResponseObject, error) {
	return GetMCPAuthorizationMetadata200JSONResponse{
		Issuer: oauthURL(""), AuthorizationEndpoint: oauthURL("/oauth2/authorize"), TokenEndpoint: oauthURL(oauthTokenPath),
		RegistrationEndpoint: oauthURL("/oauth2/register"), RevocationEndpoint: oauthURL("/oauth2/mcp/revoke"),
		ResponseTypesSupported: []string{"code"}, GrantTypesSupported: []string{"authorization_code", "refresh_token"},
		TokenEndpointAuthMethodsSupported: []string{"none"}, RevocationEndpointAuthMethodsSupported: []string{"none"},
		CodeChallengeMethodsSupported: []string{"S256"}, ScopesSupported: []string{"journal_read"},
		ClientIdMetadataDocumentSupported: true, AuthorizationResponseIssParameterSupported: true,
	}, nil
}
func journalResourceMetadata() MCPResourceMetadata {
	return MCPResourceMetadata{Resource: oauthURL(journalMCPPath), AuthorizationServers: []string{oauthURL("")}, ScopesSupported: []string{"journal_read"}, BearerMethodsSupported: []string{"header"}, ResourceName: "Voice journal"}
}
func (s *Server) GetMCPResourceMetadata(context.Context, GetMCPResourceMetadataRequestObject) (GetMCPResourceMetadataResponseObject, error) {
	return GetMCPResourceMetadata200JSONResponse(journalResourceMetadata()), nil
}
func (s *Server) GetOAuthResourceMetadata(context.Context, GetOAuthResourceMetadataRequestObject) (GetOAuthResourceMetadataResponseObject, error) {
	return GetOAuthResourceMetadata200JSONResponse(journalResourceMetadata()), nil
}
func (f *oauthFailure) VisitRegisterMCPClientResponse(w http.ResponseWriter) error { return f.write(w) }
func (f *oauthFailure) VisitAuthorizeMCPClientResponse(w http.ResponseWriter) error {
	return f.write(w)
}
func (f *oauthFailure) VisitGetMCPConsentResponse(w http.ResponseWriter) error    { return f.write(w) }
func (f *oauthFailure) VisitDecideMCPConsentResponse(w http.ResponseWriter) error { return f.write(w) }
func (f *oauthFailure) VisitExchangeMCPTokenResponse(w http.ResponseWriter) error { return f.write(w) }
func (f *oauthFailure) VisitRevokeMCPTokenResponse(w http.ResponseWriter) error   { return f.write(w) }
