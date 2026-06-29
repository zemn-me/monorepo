package main

import (
	"strings"
	"testing"
)

func TestDeclarationIncludesCssModuleClasses(t *testing.T) {
	got := string(declaration([]byte(`
.shell {}
.button-primary:hover {}
:global(.external) {}
`)))

	for _, want := range []string{
		`readonly "button-primary": string;`,
		`readonly "external": string;`,
		`readonly "shell": string;`,
		`readonly [key: string]: string;`,
		`export default styles;`,
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected declaration to contain %q, got:\n%s", want, got)
		}
	}
}
