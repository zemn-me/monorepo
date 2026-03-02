package apiserver

import "testing"

func TestConfigureTestOIDCIssuerFromEnv(t *testing.T) {
	originalIssuers := upstreamOIDCIssuers
	upstreamOIDCIssuers = map[OIDCIssuer]*upstreamIssuerConfig{}
	for issuer, cfg := range originalIssuers {
		copyCfg := &upstreamIssuerConfig{
			Provider: cfg.Provider,
			Audience: map[OAuthClientId]map[OIDCSubject]OIDCSubject{},
		}
		for audience, subjects := range cfg.Audience {
			copySubjects := map[OIDCSubject]OIDCSubject{}
			for remote, local := range subjects {
				copySubjects[remote] = local
			}
			copyCfg.Audience[audience] = copySubjects
		}
		upstreamOIDCIssuers[issuer] = copyCfg
	}
	t.Cleanup(func() {
		upstreamOIDCIssuers = originalIssuers
	})

	const (
		issuer        = "http://localhost:12345"
		clientID      = "integration-test-client"
		remoteSubject = "remote-subject"
		localSubject  = "local-subject"
		provider      = "http://localhost:54321"
	)

	t.Setenv("ZEMN_TEST_OIDC_ISSUER", issuer)
	t.Setenv("ZEMN_TEST_OIDC_CLIENT_ID", clientID)
	t.Setenv("ZEMN_TEST_OIDC_SUBJECT", remoteSubject)
	t.Setenv("ZEMN_TEST_OIDC_LOCAL_SUBJECT", localSubject)
	t.Setenv("ZEMN_TEST_OIDC_PROVIDER", provider)

	configureTestOIDCIssuerFromEnv()

	cfg, ok := upstreamOIDCIssuers[OIDCIssuer(issuer)]
	if !ok {
		t.Fatalf("expected issuer %s to be registered", issuer)
	}

	if cfg.Provider != provider {
		t.Fatalf("expected provider %q, got %q", provider, cfg.Provider)
	}

	subjectMap, ok := cfg.Audience[OAuthClientId(clientID)]
	if !ok {
		t.Fatalf("expected audience %s to be registered", clientID)
	}

	if got := subjectMap[OIDCSubject(remoteSubject)]; got != OIDCSubject(localSubject) {
		t.Fatalf("expected remote subject to map to %q, got %q", localSubject, got)
	}
}

func TestResolveProfileClaimsPrefersUpstreamWithRecordFallback(t *testing.T) {
	verified := true
	upstream := upstreamIDTokenClaims{
		Email:         "",
		EmailVerified: nil,
		Name:          "",
		GivenName:     "UpstreamGiven",
		FamilyName:    "",
		Picture:       "",
	}
	rec := &userRecord{
		Emails:        []string{"table@example.com"},
		Name:          "Table Name",
		GivenName:     "TableGiven",
		FamilyName:    "TableFamily",
		Picture:       "https://example.com/table.png",
		EmailVerified: &verified,
	}

	got := resolveProfileClaims(upstream, rec)

	if got.Email != "table@example.com" {
		t.Fatalf("expected email fallback from record, got %q", got.Email)
	}
	if got.Name != "Table Name" {
		t.Fatalf("expected name fallback from record, got %q", got.Name)
	}
	if got.GivenName != "UpstreamGiven" {
		t.Fatalf("expected given_name from upstream, got %q", got.GivenName)
	}
	if got.FamilyName != "TableFamily" {
		t.Fatalf("expected family_name fallback from record, got %q", got.FamilyName)
	}
	if got.Picture != "https://example.com/table.png" {
		t.Fatalf("expected picture fallback from record, got %q", got.Picture)
	}
	if got.EmailVerified == nil || !*got.EmailVerified {
		t.Fatalf("expected email_verified fallback from record true, got %#v", got.EmailVerified)
	}
}

func TestApplyProfileClaimsToIDTokenCopiesFields(t *testing.T) {
	verified := true
	token := applyProfileClaimsToIDToken(IdToken{}, profileClaims{
		Email:         "person@example.com",
		EmailVerified: &verified,
		Name:          "Person Example",
		GivenName:     "Person",
		FamilyName:    "Example",
		Picture:       "https://example.com/profile.png",
	})

	if token.Email == nil || *token.Email != "person@example.com" {
		t.Fatalf("expected email claim to be set, got %#v", token.Email)
	}
	if token.EmailVerified == nil || !*token.EmailVerified {
		t.Fatalf("expected email_verified claim true, got %#v", token.EmailVerified)
	}
	if token.Name == nil || *token.Name != "Person Example" {
		t.Fatalf("expected name claim to be set, got %#v", token.Name)
	}
	if token.GivenName == nil || *token.GivenName != "Person" {
		t.Fatalf("expected given_name claim to be set, got %#v", token.GivenName)
	}
	if token.FamilyName == nil || *token.FamilyName != "Example" {
		t.Fatalf("expected family_name claim to be set, got %#v", token.FamilyName)
	}
	if token.Picture == nil || *token.Picture != "https://example.com/profile.png" {
		t.Fatalf("expected picture claim to be set, got %#v", token.Picture)
	}
}

func TestApplyProfileClaimsToIDTokenOmitsEmptyStrings(t *testing.T) {
	token := applyProfileClaimsToIDToken(IdToken{}, profileClaims{})

	if token.Email != nil {
		t.Fatalf("expected empty email to be omitted, got %#v", token.Email)
	}
	if token.Name != nil {
		t.Fatalf("expected empty name to be omitted, got %#v", token.Name)
	}
	if token.GivenName != nil {
		t.Fatalf("expected empty given_name to be omitted, got %#v", token.GivenName)
	}
	if token.FamilyName != nil {
		t.Fatalf("expected empty family_name to be omitted, got %#v", token.FamilyName)
	}
	if token.Picture != nil {
		t.Fatalf("expected empty picture to be omitted, got %#v", token.Picture)
	}
}
