package apiserver

import (
	"context"
	"fmt"
	"time"

	"github.com/coreos/go-oidc"
)

// exchange a Google id_token for an api.zemn.me refresh_token.

const (
	googleClientID   = "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"
	googleOIDCIssuer = "https://accounts.google.com"
)

type OIDCTokenSelector struct {
	iss OIDCIssuer
	sub OIDCSubject
	aud OAuthClientId
}

// maps id token field selections to local subjects.
var AuthorizationMappings = map[OIDCTokenSelector]OIDCSubject{
	{
		iss: googleOIDCIssuer,
		sub: "111669004071516300752",
		aud: googleClientID,
	}: "thomas",
	{
		iss: googleOIDCIssuer,
		sub: "112149295011396650000",
		aud: googleClientID,
	}: "keng",
	{
		iss: googleOIDCIssuer,
		sub: "112149295011396651358",
		aud: googleClientID,
	}: "keng",
}

var zemnMeClient = "zemn.me"

func (s *Server) PostOauth2Token(ctx context.Context, request PostOauth2TokenRequestObject) (ro PostOauth2TokenResponseObject, err error) {
	if *request.Body.RequestedTokenType != UrnIetfParamsOauthTokenTypeIdToken {
		e := fmt.Sprintf("Unsupported requested token type: %+q", *request.Body.RequestedTokenType)
		ro = PostOauth2Token400JSONResponse{
			Error:            InvalidRequest,
			ErrorDescription: &e,
		}

		return
	}

	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		err = fmt.Errorf("failed to create OIDC provider: %w", err)
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"})

	token, err := verifier.Verify(ctx, request.Body.SubjectToken)
	if err != nil {
		err = fmt.Errorf("token verification failed: %w", err)
		return
	}

	var localId OIDCSubject
	for _, aud := range token.Audience {
		var ok bool
		if localId, ok = AuthorizationMappings[OIDCTokenSelector{
			iss: token.Issuer,
			sub: token.Subject,
			aud: OAuthClientId(aud),
		}]; ok {
			break
		}
	}

	if localId == "" {
		err = fmt.Errorf("subject is not authorized: %+v", token.Subject)
		return
	}

	api_base, err := ApiRoot()
	if err != nil {
		return
	}

	expiresAt := time.Now().Add(time.Hour * 24 * 30)

	// later i will issue refresh tokens but for now it's just id tokens!
	ourToken, err := s.IssueIdToken(ctx, IdToken{
		Aud: zemnMeClient,
		Iat: time.Now().Unix(),
		Sub: localId,
		Iss: api_base.String(),
		Exp: expiresAt.Unix(),
	})
	if err != nil {
		return
	}

	expiresInSeconds := time.Now().Sub(expiresAt) / time.Second

	ro = PostOauth2Token200JSONResponse{
		AccessToken:     ourToken,
		ExpiresIn:       int(expiresInSeconds),
		IssuedTokenType: UrnIetfParamsOauthTokenTypeIdToken,
	}

	return
}
