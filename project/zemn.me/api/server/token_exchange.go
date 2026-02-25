package apiserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc"
	"github.com/google/uuid"
)

// exchange a Google id_token for an api.zemn.me refresh_token.

const (
	googleClientID   = "845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com"
	googleOIDCIssuer = "https://accounts.google.com"
)

type upstreamIssuerConfig struct {
	Provider string
	Audience map[OAuthClientId]map[OIDCSubject]OIDCSubject
}

var upstreamOIDCIssuers = map[OIDCIssuer]*upstreamIssuerConfig{
	googleOIDCIssuer: {
		Provider: googleOIDCIssuer,
		Audience: map[OAuthClientId]map[OIDCSubject]OIDCSubject{
			googleClientID: {
				"111669004071516300752": "thomas",
				"100829149849397087770": "thomas",
				"112149295011396650000": "keng",
				"112149295011396651358": "keng",
			},
		},
	},
}

func registerOIDCMapping(issuer OIDCIssuer, provider string, audience OAuthClientId, remoteSub OIDCSubject, localSub OIDCSubject) {
	cfg, ok := upstreamOIDCIssuers[issuer]
	if !ok {
		cfg = &upstreamIssuerConfig{
			Provider: provider,
			Audience: map[OAuthClientId]map[OIDCSubject]OIDCSubject{},
		}
		upstreamOIDCIssuers[issuer] = cfg
	}

	if cfg.Provider == "" {
		cfg.Provider = provider
	}

	mapping, ok := cfg.Audience[audience]
	if !ok {
		mapping = map[OIDCSubject]OIDCSubject{}
		cfg.Audience[audience] = mapping
	}

	mapping[remoteSub] = localSub
}

func configureTestOIDCIssuerFromEnv() {
	issuer := os.Getenv("ZEMN_TEST_OIDC_ISSUER")
	if issuer == "" {
		return
	}

	clientID := os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID")
	remoteSubject := os.Getenv("ZEMN_TEST_OIDC_SUBJECT")
	localSubject := os.Getenv("ZEMN_TEST_OIDC_LOCAL_SUBJECT")
	provider := os.Getenv("ZEMN_TEST_OIDC_PROVIDER")

	if provider == "" {
		provider = issuer
	}

	if clientID == "" || remoteSubject == "" || localSubject == "" {
		return
	}

	registerOIDCMapping(
		OIDCIssuer(issuer),
		provider,
		OAuthClientId(clientID),
		OIDCSubject(remoteSubject),
		OIDCSubject(localSubject),
	)
}

func issuerFromToken(raw string) (OIDCIssuer, error) {
	parts := strings.Split(raw, ".")
	if len(parts) < 2 {
		return "", errors.New("invalid token: not enough segments")
	}

	payload, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("decode token payload: %w", err)
	}

	var claim struct {
		Iss string `json:"iss"`
	}

	if err := json.Unmarshal(payload, &claim); err != nil {
		return "", fmt.Errorf("unmarshal token payload: %w", err)
	}

	if claim.Iss == "" {
		return "", errors.New("token missing issuer")
	}

	return OIDCIssuer(claim.Iss), nil
}

var zemnMeClient = "zemn.me"

func hardcodedScopesForSubject(subject OIDCSubject) []string {
	switch subject {
	case "thomas":
		return []string{
			"admin_uid_read",
			"admin_users_read",
			"admin_users_manage",
			"callbox_settings_read",
			"callbox_settings_write",
			"grievance_portal",
		}
	case "keng":
		return []string{
			"grievance_portal",
		}
	default:
		return nil
	}
}
func (s *Server) PostOauth2Token(ctx context.Context, request PostOauth2TokenRequestObject) (ro PostOauth2TokenResponseObject, err error) {
	if request.Body == nil {
		e := "missing request body"
		ro = PostOauth2Token400JSONResponse{
			Error:            InvalidRequest,
			ErrorDescription: &e,
		}
		return
	}

	if request.Body.GrantType != UrnIetfParamsOauthGrantTypeTokenExchange {
		e := fmt.Sprintf("unsupported grant type: %q", request.Body.GrantType)
		ro = PostOauth2Token400JSONResponse{
			Error:            InvalidRequest,
			ErrorDescription: &e,
		}

		return
	}

	rawToken := request.Body.SubjectToken
	if rawToken == "" {
		err = errors.New("missing subject token")
		return
	}

	if request.Body.SubjectTokenType != UrnIetfParamsOauthTokenTypeIdToken {
		e := fmt.Sprintf("unsupported subject token type: %s", request.Body.SubjectTokenType)
		ro = PostOauth2Token400JSONResponse{
			Error:            InvalidRequest,
			ErrorDescription: &e,
		}
		return
	}

	requestedTokenType := UrnIetfParamsOauthTokenTypeIdToken
	if request.Body.RequestedTokenType != nil {
		requestedTokenType = *request.Body.RequestedTokenType
	}

	if requestedTokenType != UrnIetfParamsOauthTokenTypeIdToken {
		e := fmt.Sprintf("Unsupported requested token type: %+q", requestedTokenType)
		ro = PostOauth2Token400JSONResponse{
			Error:            InvalidRequest,
			ErrorDescription: &e,
		}

		return
	}

	issuer, err := issuerFromToken(rawToken)
	if err != nil {
		err = fmt.Errorf("failed to determine token issuer: %w", err)
		return
	}

	cfg, ok := upstreamOIDCIssuers[issuer]
	if !ok {
		err = fmt.Errorf("issuer is not supported: %s", issuer)
		return
	}

	provider, err := oidc.NewProvider(ctx, cfg.Provider)
	if err != nil {
		err = fmt.Errorf("failed to create OIDC provider: %w", err)
		return
	}

	var clientID string
	if request.Body.ClientId != nil {
		clientID = *request.Body.ClientId
	}

	s.log.Printf("Token exchange: issuer=%s subject_type=%s requested=%s audience=%s client_id=%s", issuer, request.Body.SubjectTokenType, requestedTokenType, audienceSummary(request.Body.Audience), clientID)

	resolvedUser, err := s.mapRemoteSubject(ctx, provider, cfg, rawToken, issuer)
	if err != nil {
		s.log.Printf("Token exchange failed for issuer=%s: %v", issuer, err)
		return
	}

	s.log.Printf("Token exchange success: issuer=%s mapped_subject=%s", issuer, resolvedUser.LocalID)

	apiBase, err := ApiRoot()
	if err != nil {
		return
	}

	expiresAt := time.Now().Add(time.Hour * 24 * 30)

	claims := map[string]any{
		"aud": zemnMeClient,
		"iat": time.Now().Unix(),
		"sub": resolvedUser.LocalID,
		"iss": apiBase.String(),
		"exp": expiresAt.Unix(),
		"jti": uuid.NewString(),
	}

	ourToken, err := s.IssueJWT(ctx, claims)
	if err != nil {
		return
	}

	expiresInSeconds := time.Until(expiresAt) / time.Second
	scopeStr := strings.Join(resolvedUser.Scopes, " ")
	var responseScope *string
	if scopeStr != "" {
		responseScope = &scopeStr
	}

	ro = PostOauth2Token200JSONResponse{
		AccessToken:     ourToken,
		ExpiresIn:       int(expiresInSeconds),
		IssuedTokenType: UrnIetfParamsOauthTokenTypeIdToken,
		TokenType:       "Bearer",
		Scope:           responseScope,
	}

	return
}

func audienceSummary(audience *TokenExchangeRequest_Audience) string {
	if audience == nil {
		return ""
	}

	if len(audience.union) == 0 {
		return ""
	}

	var s string
	if single, err := audience.AsTokenExchangeRequestAudience0(); err == nil && single != "" {
		s = single
	} else if many, err := audience.AsTokenExchangeRequestAudience1(); err == nil && len(many) > 0 {
		s = strings.Join(many, ",")
	}
	return s
}

type upstreamIDTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified *bool  `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

type mappedUser struct {
	LocalID OIDCSubject
	Scopes  []string
}

func (s *Server) mapRemoteSubject(
	ctx context.Context,
	provider *oidc.Provider,
	cfg *upstreamIssuerConfig,
	rawToken string,
	issuer OIDCIssuer,
) (mappedUser, error) {
	var lastErr error
	for audience, subjectMappings := range cfg.Audience {
		verifier := provider.Verifier(&oidc.Config{ClientID: string(audience)})

		token, err := verifier.Verify(ctx, rawToken)
		if err != nil {
			lastErr = err
			continue
		}

		var claims upstreamIDTokenClaims
		if err := token.Claims(&claims); err != nil {
			lastErr = err
			continue
		}
		if claims.EmailVerified != nil && !*claims.EmailVerified {
			lastErr = fmt.Errorf("email is not verified")
			continue
		}

		rec, err := s.maybeResolveUserFromTable(ctx, tokenExchangeUserDetails{
			Issuer:        string(issuer),
			Provider:      cfg.Provider,
			Audience:      string(audience),
			RemoteSubject: token.Subject,
			Email:         claims.Email,
			Name:          claims.Name,
			GivenName:     claims.GivenName,
			FamilyName:    claims.FamilyName,
			Picture:       claims.Picture,
			EmailVerified: claims.EmailVerified,
		})
		if err != nil {
			lastErr = err
			continue
		}
		if rec != nil {
			return mappedUser{
				LocalID: OIDCSubject(rec.Id),
				Scopes:  append([]string(nil), rec.Scopes...),
			}, nil
		}
		if subject, ok := subjectMappings[OIDCSubject(token.Subject)]; ok {
			scopes := hardcodedScopesForSubject(subject)
			if s.usersTableName != "" {
				rec := userRecordFromTokenExchange(subject, tokenExchangeUserDetails{
					Issuer:        string(issuer),
					Provider:      cfg.Provider,
					Audience:      string(audience),
					RemoteSubject: token.Subject,
					Email:         claims.Email,
					Name:          claims.Name,
					GivenName:     claims.GivenName,
					FamilyName:    claims.FamilyName,
					Picture:       claims.Picture,
					EmailVerified: claims.EmailVerified,
					Scopes:        scopes,
				}, scopes)
				if err := s.putUserRecord(ctx, rec); err != nil {
					return mappedUser{}, err
				}
			}
			return mappedUser{
				LocalID: subject,
				Scopes:  append([]string(nil), scopes...),
			}, nil
		}

		for _, mapped := range subjectMappings {
			if mapped == OIDCSubject(token.Subject) {
				scopes := hardcodedScopesForSubject(mapped)
				if s.usersTableName != "" {
					rec := userRecordFromTokenExchange(mapped, tokenExchangeUserDetails{
						Issuer:        string(issuer),
						Provider:      cfg.Provider,
						Audience:      string(audience),
						RemoteSubject: token.Subject,
						Email:         claims.Email,
						Name:          claims.Name,
						GivenName:     claims.GivenName,
						FamilyName:    claims.FamilyName,
						Picture:       claims.Picture,
						EmailVerified: claims.EmailVerified,
						Scopes:        scopes,
					}, scopes)
					if err := s.putUserRecord(ctx, rec); err != nil {
						return mappedUser{}, err
					}
				}
				return mappedUser{
					LocalID: mapped,
					Scopes:  append([]string(nil), scopes...),
				}, nil
			}
		}

		lastErr = fmt.Errorf("subject is not authorized: %s", token.Subject)
	}

	if lastErr != nil {
		return mappedUser{}, fmt.Errorf("token verification failed: %w", lastErr)
	}

	return mappedUser{}, errors.New("token verification failed")
}
