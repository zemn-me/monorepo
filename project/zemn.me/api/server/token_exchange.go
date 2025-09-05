package apiserver

// exchange a Google id_token for an api.zemn.me refresh_token.

const googleClientID = "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"
const googleOIDCIssuer = "https://accounts.google.com"

type OIDCTokenSelector struct {
	iss OIDCIssuer
	sub OIDCSubject
	aud OIDCClientId
}

// maps id token field selections to local subjects.
var AuthorizationMappings map[OIDCTokenSelector] OIDCSubjectId {
	OIDCTokenSelector {
		iss: googleOIDCIssuer,
		sub: "111669004071516300752"
		aud: googleClientID,
	}: "thomas",
	OIDCTokenSelector {
		iss: googleOIDCIssuer,
		sub: "112149295011396650000",
		aud: googleClientID,
	}: "keng",
	OIDCTokenSelector {
		iss: googleOIDCIssuer,
		sub: "112149295011396651358",
		aud: googleClientID,
	}: "keng",
}

var zemnMeClient = "zemn.me"

func (s *Server) PostOauth2Token(ctx context.Context, request PostOauth2TokenRequestObject) (ro PostOauth2TokenResponseObject, err error) {
	if *request.Body.RequestedTokenType != UrnIetfParamsOauthTokenTypeIdToken {
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

	var selector = OIDCTokenSelector {
		iss: token.Iss,
		sub: token.Subject,
		aud: token.Audience,
	}

	if localId, ok = AuthorizedUsersMap[selector]; !ok {
		err = fmt.Errorf("subject is not authorized: %+v", selector)
		return // this should probably be more client interrogable
	}

	api_base, err := ApiRoot()
	if err != nil { return}

	expiresAt := time.Now().Add(time.Hour * 24 * 30)

	// later i will issue refresh tokens but for now it's just id tokens!
	token, err := s.IssueIdToken(ctx, IdToken{
		Aud: zemnMeClient,
		Iat: time.Now().Unix(),
		Sub: localId,
		Iss: api_base.String(),
		Exp: expiresAt.Unix(),
	})

	if err != nil {
		return
	}

	return PostOauth2Token200JSONResponse {
		AccessToken: token,
		ExpiresIn: time.Now().Sub(expiresAt/time.Second),
		IssuedTokenType: TokenExchangeTokenTypeIdToken
	}
}
