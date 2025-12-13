package apiserver

import (
	"reflect"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	apiSpec "github.com/zemn-me/monorepo/project/zemn.me/api"
)

func TestCanonicaliseScopes_DefaultsWhenEmpty(t *testing.T) {
	got := canonicaliseScopes(nil)
	want := defaultTokenScopes()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("expected default scopes %v, got %v", want, got)
	}
}

func TestCanonicaliseScopes_FiltersAndSorts(t *testing.T) {
	got := canonicaliseScopes([]string{"grievances.write", "callbox.read", "callbox.read", "unknown"})
	want := []string{"callbox.read", "grievances.write"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected scopes: want %v, got %v", want, got)
	}
}

func TestScopesFromString_ParsesAndValidates(t *testing.T) {
	got := scopesFromString("callbox.write unknown grievances.read callbox.write")
	want := []string{"callbox.write", "grievances.read"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected scopes: want %v, got %v", want, got)
	}
}

func TestScopesToString_DeterministicOrdering(t *testing.T) {
	in := canonicaliseScopes([]string{"grievances.read", "admin.read"})
	got := scopesToString(in)
	if got != "admin.read grievances.read" {
		t.Fatalf("unexpected scope string: %q", got)
	}
}

// Ensure that every scope referenced by an operation matches the OAuthScope enum and vice versa.
func TestSpecScopesMatchEnum(t *testing.T) {
	loader := openapi3.NewLoader()
	Doc, err := loader.LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		t.Fatalf("load spec: %v", err)
	}

	// Gather enum scopes
	schemaRef, ok := Doc.Components.Schemas["OAuthScope"]
	if !ok || schemaRef == nil || schemaRef.Value == nil {
		t.Fatalf("OAuthScope schema missing")
	}
	enumScopes := map[string]struct{}{}
	for _, v := range schemaRef.Value.Enum {
		s, ok := v.(string)
		if !ok || s == "" {
			t.Fatalf("OAuthScope enum contains non-string or empty value: %v", v)
		}
		enumScopes[s] = struct{}{}
	}

	// Gather all scopes referenced by operations
	opScopes := map[string]struct{}{}
	for _, pathItem := range Doc.Paths.Map() {
		for _, op := range []*openapi3.Operation{pathItem.Get, pathItem.Put, pathItem.Post, pathItem.Delete, pathItem.Options, pathItem.Head, pathItem.Patch, pathItem.Trace} {
			if op == nil {
				continue
			}
			if op.Security == nil {
				continue
			}
			for _, secReq := range *op.Security {
				for _, scopes := range secReq {
					for _, scope := range scopes {
						opScopes[scope] = struct{}{}
					}
				}
			}
		}
	}

	if !reflect.DeepEqual(enumScopes, opScopes) {
		t.Fatalf("scopes mismatch: enum=%v op=%v", keys(enumScopes), keys(opScopes))
	}
}

// Ensure every operation either declares scopes or is explicitly allowlisted.
func TestOperationsHaveScopesOrAreAllowlisted(t *testing.T) {
	loader := openapi3.NewLoader()
	Doc, err := loader.LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		t.Fatalf("load spec: %v", err)
	}

	allowlist := map[string]struct{}{
		"/phone/init":                       {},
		"/phone/handleEntry":                {},
		"/healthz":                          {},
		"/.well-known/security.txt":         {},
		"/security.txt":                     {},
		"/.well-known/openid-configuration": {},
		"/.well-known/jwks.json":            {},
		"/.well-known/webfinger":            {},
		"/oauth2/token":                     {},
	}

	for path, pathItem := range Doc.Paths.Map() {
		for method, op := range pathItem.Operations() {
			if op == nil {
				continue
			}
			if op.Security != nil && len(*op.Security) > 0 {
				continue
			}
			if _, ok := allowlist[path]; ok {
				continue
			}
			t.Fatalf("operation %s %s has no security scopes and is not allowlisted", method, path)
		}
	}
}

func keys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
