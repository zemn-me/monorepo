package apiserver

// exchange a Google id_token for an api.zemn.me refresh_token.

// mapping of Google subject IDs to local subject IDs
var AuthorizedUsersMap = map[string]string {
	"111669004071516300752": "thomas",
	// i think she has a few Google accounts.
	"111669004071516300752": "keng",
	"112149295011396651358": "keng",
}

var zemnMeClient = "zemn.me"


func (s *Server) PostOauth2Token(ctx context.Context, request PostOauth2TokenRequestObject) (ro PostOauth2TokenResponseObject, err error) {
	if *request.Body.RequestedTokenType != UrnIetfParamsOauthTokenTypeRefreshToken {
		e := fmt.Sprintf("Unsupported requested token type: %+q", *request.Body.RequestedTokenType)
		ro = PostOauth2Token400JSONResponse {
			Error: InvalidRequest,
			ErrorDescription: &e
		}

		return
	}

	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		err = fmt.Errorf("failed to create OIDC provider: %w", err)
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"})

	token, err := verifier.Verify(ctx, Request.Body.SubjectToken)
	if err != nil {
		err = fmt.Errorf("token verification failed: %w", err)
		return
	}

	var localId string
	var ok bool

	if localId, ok = AuthorizedUsersMap[token.Subject]; !ok {
		err = fmt.Errorf("subject is not authorized: %+q", token.Subject)
		return // this should probably be more client interrogable
	}

	// we should be issuing a refresh token here instead probably
	token, err := s.IssueIdToken(ctx, IdToken{
		Aud: zemnMeClient,

	})






}
