package auth

import (
	"encoding"
	"testing"
)

func TestIdentity_Is(t *testing.T) {
	a := Identity{"https://issuer", "foo"}
	b := Identity{"https://issuer", "foo"}
	c := Identity{"https://issuer", "bar"}
	d := Identity{"https://other", "foo"}

	if !a.Is(b) {
		t.Fatalf("expected identical identities to match")
	}
	if a.Is(c) || a.Is(d) {
		t.Fatalf("mismatched identities should not compare equal")
	}
}

func TestIdentity_MarshalUnmarshalRoundTrip(t *testing.T) {
	orig := Identity{"https://example.com", "alice"}

	text, err := orig.MarshalText()
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var got Identity
	if err := got.UnmarshalText(text); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	s1 := string(mustMarshalText(orig))
	s2 := string(mustMarshalText(got))

	if s1 != s2 {
		t.Fatalf("marshal mismatch: want %q, got %q", s1, s2)
	}

	if err := orig.TryIs(got); err != nil {
		t.Fatalf("identity mismatch: %v", err)
	}

	if !orig.Is(got) {
		t.Fatalf("round-trip mismatch: want %+v, got %+v", orig, got)
	}
}

func TestIdentity_MarshalTextFormat(t *testing.T) {
	id := Identity{"https://accounts.google.com", "12345"}

	got, err := id.MarshalText()
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	want := "https://12345@accounts.google.com"

	if string(got) != want {
		t.Fatalf("marshal format mismatch:\nwant %q\ngot  %q", want, got)
	}
}

func TestIdentity_StringDelegatesToMarshal(t *testing.T) {
	id := Identity{"https://example.org", "bob"}

	if id.String() != string(mustMarshalText(id)) {
		t.Fatalf("String() should match MarshalText() output")
	}
}

// mustMarshalText returns the marshalled form or panics on error.
func mustMarshalText(m encoding.TextMarshaler) []byte {
	b, err := m.MarshalText()
	if err != nil {
		panic(err)
	}
	return b
}
