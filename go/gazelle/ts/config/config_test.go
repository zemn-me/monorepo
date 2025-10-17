package tsconfig_test

import (
	"testing"

	"github.com/bazelbuild/rules_go/go/runfiles"

	tsconfig "github.com/zemn-me/monorepo/go/gazelle/ts/config"
)

func TestParseFileCapturesPaths(t *testing.T) {
	rf, err := runfiles.New()
	if err != nil {
		t.Fatalf("runfiles.New: %v", err)
	}

	tsconfigPath, err := rf.Rlocation("_main/tsconfig.json")
	if err != nil {
		t.Fatalf("runfiles tsconfig.json: %v", err)
	}

	conf, err := tsconfig.ParseFile(tsconfigPath)
	if err != nil {
		t.Fatalf("ParseFile: %v", err)
	}

	if conf.CompilerOptions.BaseURL == "" {
		t.Fatalf("expected BaseURL to be set, got empty string")
	}

	paths := conf.PathMappings()
	if len(paths) == 0 {
		t.Fatalf("expected PathMappings to be populated")
	}

	root, ok := paths["#root/*"]
	if !ok {
		t.Fatalf("expected #root/* mapping to exist")
	}

	if len(root) == 0 || root[0] != "*" {
		t.Fatalf("expected #root/* mapping to contain \"*\", got %v", root)
	}
}
