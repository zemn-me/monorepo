package apiserver

import (
	"reflect"
	"testing"
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
