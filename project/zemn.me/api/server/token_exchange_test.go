package apiserver

import (
	"testing"

	api_types "github.com/zemn-me/monorepo/project/zemn.me/api/server/types"
)

func TestConfigureTestOIDCIssuerFromEnv(t *testing.T) {
	originalIssuers := upstreamOIDCIssuers
	upstreamOIDCIssuers = map[api_types.OIDCIssuer]*upstreamIssuerConfig{}
	for issuer, cfg := range originalIssuers {
		copyCfg := &upstreamIssuerConfig{
			Provider: cfg.Provider,
			Audience: map[api_types.OAuthClientId]map[api_types.OIDCSubject]api_types.OIDCSubject{},
		}
		for audience, subjects := range cfg.Audience {
			copySubjects := map[api_types.OIDCSubject]api_types.OIDCSubject{}
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

	cfg, ok := upstreamOIDCIssuers[api_types.OIDCIssuer(issuer)]
	if !ok {
		t.Fatalf("expected issuer %s to be registered", issuer)
	}

	if cfg.Provider != provider {
		t.Fatalf("expected provider %q, got %q", provider, cfg.Provider)
	}

	subjectMap, ok := cfg.Audience[api_types.OAuthClientId(clientID)]
	if !ok {
		t.Fatalf("expected audience %s to be registered", clientID)
	}

	if got := subjectMap[api_types.OIDCSubject(remoteSubject)]; got != api_types.OIDCSubject(localSubject) {
		t.Fatalf("expected remote subject to map to %q, got %q", localSubject, got)
	}
}
