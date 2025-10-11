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
	emptyAuth := &[]OIDCConfigurationTokenEndpointAuthMethodsSupported{}

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
		ResponseTypesSupported:           []string{},
		SubjectTypesSupported:            []OIDCConfigurationSubjectTypesSupported{},
		IdTokenSigningAlgValuesSupported: []string{s.signingKey.Algorithm},

		AcrValuesSupported:     emptyStrings,
		ClaimTypesSupported:    emptyClaims,
		ClaimsLocalesSupported: emptyStrings,
		ClaimsSupported:        emptyStrings,
		DisplayValuesSupported: emptyStrings,
		GrantTypesSupported: &[]OAuthGrantType{
			UrnIetfParamsOauthGrantTypeTokenExchange,
		},
		IdTokenEncryptionAlgValuesSupported:        emptyStrings,
		IdTokenEncryptionEncValuesSupported:        emptyStrings,
		RequestObjectEncryptionAlgValuesSupported:  emptyStrings,
		RequestObjectEncryptionEncValuesSupported:  emptyStrings,
		RequestObjectSigningAlgValuesSupported:     emptyStrings,
		ResponseModesSupported:                     emptyStrings,
		ScopesSupported:                            &[]string{},
		TokenEndpointAuthMethodsSupported:          emptyAuth,
		TokenEndpointAuthSigningAlgValuesSupported: emptyStrings,
		UiLocalesSupported:                         emptyStrings,
		UserinfoEncryptionAlgValuesSupported:       emptyStrings,
		UserinfoEncryptionEncValuesSupported:       emptyStrings,
		UserinfoSigningAlgValuesSupported:          emptyStrings,

		TokenEndpoint:                 nil,
		UserinfoEndpoint:              nil,
		RegistrationEndpoint:          nil,
		ServiceDocumentation:          nil,
		OpPolicyUri:                   nil,
		OpTosUri:                      nil,
		ClaimsParameterSupported:      nil,
		RequestParameterSupported:     nil,
		RequestUriParameterSupported:  nil,
		RequireRequestUriRegistration: nil,
	}, nil
}

func (s *Server) GetOpenIDConnectRootConfiguration(ctx context.Context, request GetOpenIDConnectRootConfigurationRequestObject) (GetOpenIDConnectRootConfigurationResponseObject, error) {
	r, e := s.getOpenIDConnectRootConfiguration(ctx, request)

	return GetOpenIDConnectRootConfiguration200JSONResponse(r), e
}
