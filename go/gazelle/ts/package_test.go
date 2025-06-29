package ts

import "testing"

func TestNodeModulesModuleFromImportString(t *testing.T) {
	cases := map[string]string{
		"@types/node":                "@types/node",
		"@scope/pkg/lib":             "@scope/pkg",
		"react":                      "react",
		"eslint-plugin-react/config": "eslint-plugin-react",
	}
	for input, want := range cases {
		if got := nodeModulesModuleFromImportString(input); got != want {
			t.Fatalf("%s -> %s, want %s", input, got, want)
		}
	}
}

func TestImportAlias(t *testing.T) {
	got := importAlias("ts/pkg", "file.ts")
	want := "#root/ts/pkg/file.js"
	if got != want {
		t.Fatalf("want %s, got %s", want, got)
	}
}

func TestInAllowlist(t *testing.T) {
	cases := map[string]bool{
		"ts":           true,
		"ts/a":         false,
		"ts/a/b":       true,
		"other/module": false,
	}
	for pkg, want := range cases {
		if got := inAllowlist(pkg); got != want {
			t.Fatalf("%s allow = %v, want %v", pkg, got, want)
		}
	}
}
