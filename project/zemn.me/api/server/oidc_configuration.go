package apiserver

import (
	"context"
	"net/url"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

func strptr(s string) *string { return &s }
func boolptr(b bool) *bool    { return &b }

func (s *Server) getOpenIDConnectRootConfiguration(
	ctx context.Context,
	_ api_types.GetOpenIDConnectRootConfigurationRequestObject,
) (conf api_types.OIDCConfiguration, err error) {
	emptyStrings := &[]string{}
	emptyClaims := &[]api_types.OIDCConfigurationClaimTypesSupported{}
	emptyAuth := &[]api_types.OIDCConfigurationTokenEndpointAuthMethodsSupported{}

	apiRoot, err := ApiRoot()
	if err != nil {
		return
	}

	var authEndpoint url.URL = *apiRoot

	authEndpoint.Path = "/oauth2/authorize"

	var jwksEndpoint url.URL = *apiRoot
	jwksEndpoint.Path = "/.well-known/jwks.json"

	return api_types.OIDCConfiguration{
		Issuer:                           apiRoot.String(),
		AuthorizationEndpoint:            authEndpoint.String(),
		JwksUri:                          jwksEndpoint.String(),
		ResponseTypesSupported:           []string{},
		SubjectTypesSupported:            []api_types.OIDCConfigurationSubjectTypesSupported{},
		IdTokenSigningAlgValuesSupported: []string{s.signingKey.Algorithm},

		AcrValuesSupported:     emptyStrings,
		ClaimTypesSupported:    emptyClaims,
		ClaimsLocalesSupported: emptyStrings,
		ClaimsSupported:        emptyStrings,
		DisplayValuesSupported: emptyStrings,
		GrantTypesSupported: &[]api_types.OAuthGrantType{
			api_types.UrnIetfParamsOauthGrantTypeTokenExchange,
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

func (s *Server) GetOpenIDConnectRootConfiguration(ctx context.Context, request api_types.GetOpenIDConnectRootConfigurationRequestObject) (api_types.GetOpenIDConnectRootConfigurationResponseObject, error) {
	r, e := s.getOpenIDConnectRootConfiguration(ctx, request)

	return api_types.GetOpenIDConnectRootConfiguration200JSONResponse(r), e
}
