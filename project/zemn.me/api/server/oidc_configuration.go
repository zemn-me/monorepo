package apiserver

import "context"

func strptr(s string) *string { return &s }
func boolptr(b bool) *bool    { return &b }

func (s *Server) getOpenIDConnectRootConfiguration(
	ctx context.Context,
	_ GetOpenIDConnectRootConfigurationRequestObject,
) (OIDCConfiguration, error) {
	emptyStrings := &[]string{}
	emptyClaims := &[]OIDCConfigurationClaimTypesSupported{}
	emptyAuth := &[]OIDCConfigurationTokenEndpointAuthMethodsSupported{}

	return OIDCConfiguration{
		Issuer:                           "https://api.zemn.me",
		AuthorizationEndpoint:            "https://api.zemn.me/oauth2/authorize",
		JwksUri:                          "https://api.zemn.me/.well-known/jwks.json",
		ResponseTypesSupported:           []string{},
		SubjectTypesSupported:            []OIDCConfigurationSubjectTypesSupported{},
		IdTokenSigningAlgValuesSupported: []string{s.signingKey.Algorithm},

		AcrValuesSupported:                         emptyStrings,
		ClaimTypesSupported:                        emptyClaims,
		ClaimsLocalesSupported:                     emptyStrings,
		ClaimsSupported:                            emptyStrings,
		DisplayValuesSupported:                     emptyStrings,
		GrantTypesSupported:                        emptyStrings,
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
