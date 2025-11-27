package apiserver

import (
	"sort"
	"strings"
)

// List of OAuth scopes recognised by the API. Keep the slice stable so we can
// present a deterministic scope string.
var supportedAPIScopes = []string{
	"admin.read",
	"callbox.read",
	"callbox.write",
	"grievances.read",
	"grievances.write",
}

var supportedAPIScopeSet = func() map[string]struct{} {
	m := make(map[string]struct{}, len(supportedAPIScopes))
	for _, s := range supportedAPIScopes {
		m[s] = struct{}{}
	}
	return m
}()

// defaultTokenScopes returns the scopes assigned when the client does not
// request anything explicit.
func defaultTokenScopes() []string {
	return append([]string(nil), supportedAPIScopes...)
}

// canonicaliseScopes validates, deduplicates, and sorts scopes. Unknown scopes
// are dropped so that callers cannot mint arbitrary strings into tokens.
func canonicaliseScopes(requested []string) []string {
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
	return canonicaliseScopes(strings.Fields(scope))
}

// scopesToString joins scopes with a single space using deterministic ordering.
func scopesToString(scopes []string) string {
	return strings.Join(scopes, " ")
}

// pointerCopy returns a new pointer for a slice so callers can mutate without
// affecting the original.
func pointerCopy(scopes []string) *[]string {
	dup := append([]string(nil), scopes...)
	return &dup
}

// pointerCopyOAuthScopes converts a []string to []OAuthScope and returns a new
// pointer so callers can safely modify it.
func pointerCopyOAuthScopes(scopes []string) *[]OAuthScope {
	dup := make([]OAuthScope, len(scopes))
	for i, scope := range scopes {
		dup[i] = OAuthScope(scope)
	}
	return &dup
}
