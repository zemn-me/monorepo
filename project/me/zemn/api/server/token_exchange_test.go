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
