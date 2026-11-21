package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/coreos/go-oidc"
	"github.com/zemn-me/monorepo/project/me/zemn/api/server/auth"
	"io"
	"net/http"
	"slices"
	"testing"
	"time"
)

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

// Exercise signed upstream tokens to keep account resolution bound to subjects.
func TestGoogleJournalOwnerRequiresKnownSubject(t *testing.T) {
	for _, tc := range []struct {
		name, issuer, audience, email                      string
		verified                                           *bool
		usersTable, existingOwner, knownSubject, wantOwner bool
	}{
		{verified: ptr(true), name: "without users table", usersTable: false},
		{verified: ptr(true), name: "bootstrap owner", usersTable: true},
		{verified: ptr(true), name: "existing owner", usersTable: true, existingOwner: true},
		{verified: ptr(true), name: "normalized email", email: "Thomas@Shadwell.IM"},
		{verified: ptr(true), name: "known configured subject", knownSubject: true, wantOwner: true},
		{verified: ptr(true), name: "bootstrap configured subject", usersTable: true, knownSubject: true, wantOwner: true},
		{verified: ptr(true), name: "known stored subject", usersTable: true, existingOwner: true, knownSubject: true, wantOwner: true},
		{verified: ptr(true), name: "known stored subject with changed email", email: "other@example.com", usersTable: true, existingOwner: true, knownSubject: true, wantOwner: true},
		{verified: ptr(true), name: "same subject from different issuer", issuer: "https://other.example", usersTable: true, existingOwner: true, knownSubject: true},
		{verified: ptr(true), name: "different email", email: "other@example.com"},
		{verified: ptr(true), name: "email suffix", email: "thomas@shadwell.im.attacker.example"},
		{name: "unverified email", verified: ptr(false)},
		{name: "missing verification"},
		{name: "stored email without verification", usersTable: true, existingOwner: true},
		{name: "stored unverified email", verified: ptr(false), usersTable: true, existingOwner: true},
		{verified: ptr(true), name: "different issuer", issuer: "https://other.example"},
		{verified: ptr(true), name: "different audience", audience: "other-client"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			issuer, audience, email := tc.issuer, tc.audience, tc.email
			if issuer == "" {
				issuer = googleOIDCIssuer
			}
			if audience == "" {
				audience = googleClientID
			}
			if email == "" {
				email = "thomas@shadwell.im"
			}
			s, _, ctx, entries, _ := journalKnowledgeFixture(t)
			if tc.usersTable {
				s.usersTableName = "users"
			}
			if tc.existingOwner {
				subject := "old-google-subject"
				if tc.knownSubject {
					subject = "new-google-subject"
				}
				if err := s.putUserRecord(ctx, userRecord{Id: journalOwnerSubject, When: Now(), Emails: []string{"thomas@shadwell.im"}, Scopes: []string{"journal_read", "journal_write"}, SubjectIds: addSubjectID(nil, googleOIDCIssuer, subject)}); err != nil {
					t.Fatal(err)
				}
			}
			signer := newOIDCAuthenticationTestServer(t, NewServerOptions{})
			token, err := signer.IssueJWT(ctx, map[string]any{
				"iss": issuer, "sub": "new-google-subject", "aud": audience,
				"exp": time.Now().Add(time.Hour).Unix(), "email": email, "email_verified": tc.verified,
			})
			if err != nil {
				t.Fatal(err)
			}
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				var doc any
				switch r.URL.String() {
				case issuer + "/.well-known/openid-configuration":
					doc = map[string]any{"issuer": issuer, "jwks_uri": issuer + "/jwks", "id_token_signing_alg_values_supported": []string{"ES256"}}
				case issuer + "/jwks":
					doc = signer.keySet()
				default:
					return nil, fmt.Errorf("unexpected URL: %s", r.URL)
				}
				data, err := json.Marshal(doc)
				if err != nil {
					return nil, err
				}
				return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(bytes.NewReader(data))}, nil
			})}
			ctx = oidc.ClientContext(ctx, client)
			provider, err := oidc.NewProvider(ctx, issuer)
			if err != nil {
				t.Fatal(err)
			}
			subjectMappings := map[OIDCSubject]OIDCSubject{}
			if tc.knownSubject && !tc.existingOwner {
				subjectMappings["new-google-subject"] = journalOwnerSubject
			}
			cfg := &upstreamIssuerConfig{Provider: issuer, Audience: map[OAuthClientId]map[OIDCSubject]OIDCSubject{OAuthClientId(audience): subjectMappings}}
			mapped, err := s.translateUpstreamUser(ctx, provider, cfg, token, OIDCIssuer(issuer))
			if !tc.wantOwner {
				if err == nil {
					t.Fatalf("unexpected authorization: %+v", mapped)
				}
				if tc.usersTable {
					rec, lookupErr := s.findUserByRemoteSubject(ctx, issuer, "new-google-subject")
					if lookupErr != nil || rec != nil {
						t.Fatalf("unexpected subject link: %+v, %v", rec, lookupErr)
					}
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if mapped.LocalID != journalOwnerSubject || !slices.Contains(mapped.Scopes, "journal_read") || !slices.Contains(mapped.Scopes, "journal_write") {
				t.Fatalf("wrong owner or journal scopes: %+v", mapped)
			}
			if tc.existingOwner && len(mapped.Scopes) != 2 {
				t.Fatalf("changed existing owner scopes: %v", mapped.Scopes)
			}
			if tc.usersTable {
				rec, err := s.findUserByRemoteSubject(ctx, googleOIDCIssuer, "new-google-subject")
				if err != nil || rec == nil || rec.Id != journalOwnerSubject {
					t.Fatalf("new subject not linked to owner: %+v, %v", rec, err)
				}
			}
			ctx = context.WithValue(ctx, auth.IDTokenKey, &auth.IDToken{Issuer: "https://api.zemn.me", Subject: string(mapped.LocalID)})
			response, err := s.GetJournal(ctx, GetJournalRequestObject{})
			if err != nil {
				t.Fatal(err)
			}
			journal, ok := response.(GetJournal200JSONResponse)
			if !ok || len(journal.Entries) != len(entries) {
				t.Fatalf("existing journal unavailable: %+v", response)
			}
		})
	}
}
