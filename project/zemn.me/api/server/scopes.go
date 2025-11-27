package apiserver

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	apiSpec "github.com/zemn-me/monorepo/project/zemn.me/api"
)

var (
	onceScopes           sync.Once
	supportedAPIScopes   []string
	supportedAPIScopeSet map[string]struct{}
)

func loadScopesFromSpec() ([]string, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData([]byte(apiSpec.Spec))
	if err != nil {
		return nil, err
	}

	schemaRef, ok := doc.Components.Schemas["OAuthScope"]
	if !ok || schemaRef == nil || schemaRef.Value == nil {
		return nil, fmt.Errorf("OAuthScope schema missing in spec")
	}

	var scopes []string
	for _, enumVal := range schemaRef.Value.Enum {
		if s, ok := enumVal.(string); ok && s != "" {
			scopes = append(scopes, s)
		}
	}

	if len(scopes) == 0 {
		return nil, fmt.Errorf("OAuthScope enum empty in spec")
	}

	sort.Strings(scopes)
	return scopes, nil
}

func initSupportedScopes() {
	onceScopes.Do(func() {
		var err error
		supportedAPIScopes, err = loadScopesFromSpec()
		if err != nil {
			log.Fatalf("Scopes: cannot initialise from spec: %v", err)
		}
		supportedAPIScopeSet = make(map[string]struct{}, len(supportedAPIScopes))
		for _, s := range supportedAPIScopes {
			supportedAPIScopeSet[s] = struct{}{}
		}
	})
}

// defaultTokenScopes returns the scopes assigned when the client does not
// request anything explicit.
func defaultTokenScopes() []string {
	initSupportedScopes()
	return append([]string(nil), supportedAPIScopes...)
}

// canonicaliseScopes validates, deduplicates, and sorts scopes. Unknown scopes
// are dropped so that callers cannot mint arbitrary strings into tokens.
func canonicaliseScopes(requested []string) []string {
	initSupportedScopes()
	set := map[string]struct{}{}

	for _, scope := range requested {
		if scope == "" {
			continue
		}
		if _, ok := supportedAPIScopeSet[scope]; !ok {
			continue
		}
		set[scope] = struct{}{}
	}

	if len(set) == 0 {
		return defaultTokenScopes()
	}

	out := make([]string, 0, len(set))
	for scope := range set {
		out = append(out, scope)
	}
	sort.Strings(out)
	return out
}

// scopesFromString splits a space-delimited scope string and canonicalises it.
func scopesFromString(scope string) []string {
	initSupportedScopes()
	return canonicaliseScopes(strings.Fields(scope))
}

// scopesToString joins scopes with a single space using deterministic ordering.
func scopesToString(scopes []string) string {
	return strings.Join(scopes, " ")
}

// pointerCopy returns a new pointer for a slice so callers can mutate without
// affecting the original.
func pointerCopy(scopes []string) *[]string {
	initSupportedScopes()
	dup := append([]string(nil), scopes...)
	return &dup
}

// pointerCopyOAuthScopes converts a []string to []OAuthScope and returns a new
// pointer so callers can safely modify it.
func pointerCopyOAuthScopes(scopes []string) *[]OAuthScope {
	initSupportedScopes()
	dup := make([]OAuthScope, len(scopes))
	for i, scope := range scopes {
		dup[i] = OAuthScope(scope)
	}
	return &dup
}
