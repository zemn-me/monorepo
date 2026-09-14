package apiserver

import (
	"context"
	"net/url"
)

func strptr(s string) *string { return &s }
func boolptr(b bool) *bool    { return &b }

func (s *Server) getOpenIDConnectRootConfiguration(
	ctx context.Context,
	_ GetOpenIDConnectRootConfigurationRequestObject,
) (conf OIDCConfiguration, err error) {
	emptyStrings := &[]string{}
	emptyClaims := &[]OIDCConfigurationClaimTypesSupported{}
	publicAuth := &[]OIDCConfigurationTokenEndpointAuthMethodsSupported{"none"}

	apiRoot, err := ApiRoot()
	if err != nil {
		return
	}

	var authEndpoint url.URL = *apiRoot

	authEndpoint.Path = "/oauth2/authorize"

	var jwksEndpoint url.URL = *apiRoot
	jwksEndpoint.Path = "/.well-known/jwks.json"

	return OIDCConfiguration{
		Issuer:                           apiRoot.String(),
		AuthorizationEndpoint:            authEndpoint.String(),
		JwksUri:                          jwksEndpoint.String(),
		ResponseTypesSupported:           []string{"code"},
		SubjectTypesSupported:            []OIDCConfigurationSubjectTypesSupported{"public"},
		IdTokenSigningAlgValuesSupported: []string{s.signingKey.Algorithm},

		AcrValuesSupported:     emptyStrings,
		ClaimTypesSupported:    emptyClaims,
		ClaimsLocalesSupported: emptyStrings,
		ClaimsSupported:        emptyStrings,
		DisplayValuesSupported: emptyStrings,
		GrantTypesSupported: &[]OAuthGrantType{
			"authorization_code", "refresh_token",
		},
		IdTokenEncryptionAlgValuesSupported:        emptyStrings,
		IdTokenEncryptionEncValuesSupported:        emptyStrings,
		RequestObjectEncryptionAlgValuesSupported:  emptyStrings,
		RequestObjectEncryptionEncValuesSupported:  emptyStrings,
		RequestObjectSigningAlgValuesSupported:     emptyStrings,
		ResponseModesSupported:                     &[]string{"query"},
		ScopesSupported:                            &[]string{"journal_read"},
		TokenEndpointAuthMethodsSupported:          publicAuth,
		TokenEndpointAuthSigningAlgValuesSupported: emptyStrings,
		UiLocalesSupported:                         emptyStrings,
		UserinfoEncryptionAlgValuesSupported:       emptyStrings,
		UserinfoEncryptionEncValuesSupported:       emptyStrings,
		UserinfoSigningAlgValuesSupported:          emptyStrings,

		TokenEndpoint:                              strptr(oauthURL(oauthTokenPath)),
		UserinfoEndpoint:                           nil,
		CodeChallengeMethodsSupported:              &[]string{"S256"},
		ClientIdMetadataDocumentSupported:          boolptr(true),
		AuthorizationResponseIssParameterSupported: boolptr(true),
		RevocationEndpoint:                         strptr(oauthURL("/oauth2/mcp/revoke")),
		RegistrationEndpoint:                       strptr(oauthURL("/oauth2/register")),
		ServiceDocumentation:                       nil,
		OpPolicyUri:                                nil,
		OpTosUri:                                   nil,
		ClaimsParameterSupported:                   nil,
		RequestParameterSupported:                  nil,
		RequestUriParameterSupported:               nil,
		RequireRequestUriRegistration:              nil,
	}, nil
}

func (s *Server) GetOpenIDConnectRootConfiguration(ctx context.Context, request GetOpenIDConnectRootConfigurationRequestObject) (GetOpenIDConnectRootConfigurationResponseObject, error) {
	r, e := s.getOpenIDConnectRootConfiguration(ctx, request)

	return GetOpenIDConnectRootConfiguration200JSONResponse(r), e
}
