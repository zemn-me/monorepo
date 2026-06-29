package main

import (
	"bytes"
	"testing"
)

func TestDeclarationUsesCSSParser(t *testing.T) {
	output, err := declaration([]byte(`
.shell { display: block; }
.button-primary:hover { color: red; }
:global(.external) { color: blue; }
:local(.explicit) { color: purple; }
.composed {
	composes: shell;
	color: green;
}
`))
	if err != nil {
		t.Fatalf("declaration: %v", err)
	}

	for _, want := range [][]byte{
		[]byte(`readonly "button-primary": string;`),
		[]byte(`readonly "composed": string;`),
		[]byte(`readonly "explicit": string;`),
		[]byte(`readonly "shell": string;`),
		[]byte(`readonly [key: string]: string;`),
		[]byte(`export default styles;`),
	} {
		if !bytes.Contains(output, want) {
			t.Fatalf("expected output to contain %q, got:\n%s", want, output)
		}
	}

	if bytes.Contains(output, []byte(`readonly "external": string;`)) {
		t.Fatalf("expected global class to be absent, got:\n%s", output)
	}
}
