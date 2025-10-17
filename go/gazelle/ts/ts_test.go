package ts_test

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	bzl "github.com/bazelbuild/buildtools/build"
	"github.com/bazelbuild/rules_go/go/runfiles"

	ts "github.com/zemn-me/monorepo/go/gazelle/ts"
)

func repoRoot(t *testing.T) string {
	t.Helper()

	if ws := os.Getenv("BUILD_WORKSPACE_DIRECTORY"); ws != "" {
		return ws
	}

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

func generateRulesOnly(t *testing.T, rel string, files []string) language.GenerateResult {
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

	return lang.GenerateRules(args)
}

func generateAndResolveAllRules(t *testing.T, rel string, files []string) map[string]*rule.Rule {
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

	idx := resolve.NewRuleIndex(func(r *rule.Rule, pkgRel string) resolve.Resolver { return nil })
	all := make(map[string]*rule.Rule)
	for i, generated := range result.Gen {
		all[generated.Name()] = generated
		if imports := result.Imports[i]; imports != nil {
			lbl := label.New("", rel, generated.Name())
			lang.Resolve(dirCfg, idx, nil, generated, imports, lbl)
		}
	}

	return all
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
	var (
		projectRule    *rule.Rule
		projectImports interface{}
	)
	for i, generated := range result.Gen {
		if generated.Kind() == "ts_project" {
			projectRule = generated
			projectImports = result.Imports[i]
			break
		}
	}

	if projectRule == nil {
		t.Fatalf("expected to generate a ts_project rule, but got %d rules", len(result.Gen))
	}

	r := projectRule
	imports := projectImports

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

	wantSrcs := []string{"hello.ts"}
	if !reflect.DeepEqual(srcs, wantSrcs) {
		t.Fatalf("srcs mismatch: got %v want %v", srcs, wantSrcs)
	}

	assertContains(t, deps, "//:node_modules/@types/node")
}

func TestResolveAddsRepositoryDependencyFromAlias(t *testing.T) {
	rel := "go/gazelle/ts/testdata/uses_option"
	files := []string{"sample.ts"}

	_, deps := generateAndResolveRule(t, rel, files)

	assertContains(t, deps, "//go/gazelle/ts/testdata/dependency")
	assertContains(t, deps, "//:node_modules/@types/node")
}

func TestResolveAddsTsTimeDependency(t *testing.T) {
	rel := "go/gazelle/ts/example/duration"
	files := []string{"duration.ts", "duration_test.ts"}

	_, deps := generateAndResolveRule(t, rel, files)

	found := false
	for _, dep := range deps {
		if strings.HasPrefix(dep, "//ts/time") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected dependency on //ts/time, got %v", deps)
	}
	assertContains(t, deps, "//:node_modules/@types/node")
}

func TestAllowedPrefixesIncludesTsMath(t *testing.T) {
	found := false
	for _, prefix := range ts.AllowedPrefixes {
		if prefix == "ts/math" {
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("expected AllowedPrefixes to include ts/math, got %v", ts.AllowedPrefixes)
	}
}

func TestResolveAddsMeshDependencies(t *testing.T) {
	rel := "ts/math/mesh"
	files := []string{"mesh.ts"}

	_, deps := generateAndResolveRule(t, rel, files)

	foundMath := false
	for _, dep := range deps {
		if strings.HasPrefix(dep, "//ts/math") {
			foundMath = true
			break
		}
	}
	if !foundMath {
		t.Fatalf("expected dependency on ts/math, got %v", deps)
	}
	assertContains(t, deps, "//ts/iter")
	assertContains(t, deps, "//:node_modules/@types/node")
}

func TestGenerateRulesAddsJsdomAttributeWhenDirectivePresent(t *testing.T) {
	rel := "go/gazelle/ts/testdata/jsdom"
	files := []string{"foo.ts", "foo_test.ts"}

	result := generateRulesOnly(t, rel, files)

	var jestRule *rule.Rule
	for _, generated := range result.Gen {
		if generated.Kind() == "jest_test" {
			jestRule = generated
			break
		}
	}

	if jestRule == nil {
		t.Fatalf("expected to generate a jest_test rule, but none was found")
	}

	attr := jestRule.Attr("jsdom")
	if attr == nil {
		t.Fatalf("expected jest_test rule to have a jsdom attribute")
	}

	lit, ok := attr.(*bzl.LiteralExpr)
	if !ok {
		t.Fatalf("expected jsdom attribute to be a literal, got %T", attr)
	}
	if lit.Token != "True" {
		t.Fatalf("expected jsdom attribute to be True, got %s", lit.Token)
	}
}

func TestGenerateRulesSeparatesTestSources(t *testing.T) {
	rel := "ts/math/shape"
	files := []string{"index.ts", "shape_test.tsx"}

	result := generateRulesOnly(t, rel, files)

	var (
		mainRule *rule.Rule
		testRule *rule.Rule
	)
	for _, generated := range result.Gen {
		if generated.Kind() != "ts_project" {
			continue
		}
		switch generated.Name() {
		case "shape":
			mainRule = generated
		case "shape_tests":
			testRule = generated
		}
	}

	if mainRule == nil || testRule == nil {
		t.Fatalf("expected both shape and shape_tests ts_project rules, got %v", result.Gen)
	}

	mainSrcs := mainRule.AttrStrings("srcs")
	if !reflect.DeepEqual(mainSrcs, []string{"index.ts"}) {
		t.Fatalf("shape srcs mismatch: got %v want [index.ts]", mainSrcs)
	}

	testSrcs := testRule.AttrStrings("srcs")
	if !reflect.DeepEqual(testSrcs, []string{"shape_test.tsx"}) {
		t.Fatalf("shape_tests srcs mismatch: got %v want [shape_test.tsx]", testSrcs)
	}
}

func TestResolveKeepsTestDependencyOnMainRule(t *testing.T) {
	rel := "ts/math/mesh"
	files := []string{"mesh.ts", "mesh_test.ts"}

	rules := generateAndResolveAllRules(t, rel, files)

	testRule, ok := rules["mesh_tests"]
	if !ok {
		t.Fatalf("expected mesh_tests rule to be generated, rules: %v", rules)
	}

	deps := testRule.AttrStrings("deps")
	assertContains(t, deps, ":mesh")
}

func TestResolveMapsSubmoduleImportToRootModule(t *testing.T) {
	rel := "go/gazelle/ts/testdata/submodule"
	files := []string{"consumer.ts"}

	_, deps := generateAndResolveRule(t, rel, files)

	assertContains(t, deps, "//:node_modules/react-dom")
}
