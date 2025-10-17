package ts_test

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	"github.com/bazelbuild/rules_go/go/runfiles"

	ts "github.com/zemn-me/monorepo/go/gazelle/ts"
)

func repoRoot(t *testing.T) string {
	t.Helper()

	rf, err := runfiles.New()
	if err != nil {
		t.Fatalf("runfiles.New: %v", err)
	}

	pkgPath, err := rf.Rlocation("_main/package.json")
	if err != nil {
		t.Fatalf("runfiles package.json: %v", err)
	}

	return filepath.Dir(pkgPath)
}

func newTestConfig(t *testing.T) *config.Config {
	t.Helper()

	root := repoRoot(t)

	cfg := config.New()
	cfg.RepoRoot = root
	cfg.WorkDir = root
	return cfg
}

func generateAndResolveRule(t *testing.T, rel string, files []string) ([]string, []string) {
	t.Helper()

	cfg := newTestConfig(t)

	var lang ts.Language
	lang.Configure(cfg, "", nil)

	dirCfg := cfg.Clone()
	lang.Configure(dirCfg, rel, nil)

	args := language.GenerateArgs{
		Config:       dirCfg,
		Dir:          filepath.Join(cfg.RepoRoot, rel),
		Rel:          rel,
		RegularFiles: files,
	}

	result := lang.GenerateRules(args)
	if len(result.Gen) != 1 {
		t.Fatalf("expected 1 generated rule, got %d", len(result.Gen))
	}

	r := result.Gen[0]
	imports := result.Imports[0]

	lbl := label.New("", rel, r.Name())
	idx := resolve.NewRuleIndex(func(r *rule.Rule, pkgRel string) resolve.Resolver { return nil })

	lang.Resolve(dirCfg, idx, nil, r, imports, lbl)

	srcs := r.AttrStrings("srcs")
	deps := r.AttrStrings("deps")

	return srcs, deps
}

func assertContains(t *testing.T, haystack []string, needle string) {
	t.Helper()

	for _, item := range haystack {
		if item == needle {
			return
		}
	}
	t.Fatalf("expected %q to be present in %v", needle, haystack)
}

func TestGenerateRulesExampleSimple(t *testing.T) {
	rel := "go/gazelle/ts/example/simple"
	files := []string{"hello.ts", "hello_test.ts"}

	srcs, deps := generateAndResolveRule(t, rel, files)

	wantSrcs := []string{"hello.ts", "hello_test.ts"}
	if !reflect.DeepEqual(srcs, wantSrcs) {
		t.Fatalf("srcs mismatch: got %v want %v", srcs, wantSrcs)
	}

	assertContains(t, deps, "//:node_modules/@jest/globals")
	assertContains(t, deps, "//:node_modules/@types/node")
}

func TestResolveAddsRepositoryDependencyFromAlias(t *testing.T) {
	rel := "go/gazelle/ts/testdata/uses_option"
	files := []string{"sample.ts"}

	_, deps := generateAndResolveRule(t, rel, files)

	assertContains(t, deps, "//go/gazelle/ts/testdata/dependency")
	assertContains(t, deps, "//:node_modules/@jest/globals")
	assertContains(t, deps, "//:node_modules/@types/node")
}
