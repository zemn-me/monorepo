package ts

import (
	"os"
	"path"
	"reflect"
	"testing"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	build "github.com/bazelbuild/buildtools/build"

	testdata "github.com/zemn-me/monorepo/go/gazelle/ts/testdata"
)

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(path.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestListImports(t *testing.T) {
	dir := t.TempDir()
	fname := path.Join(dir, "main.ts")
	writeFile(t, dir, "main.ts", testdata.ExampleFile)
	imps, err := listImports(fname)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"./foo", "./bar", "lib"}
	if !reflect.DeepEqual(imps, want) {
		t.Fatalf("imports=%v want %v", imps, want)
	}
}

func TestGenerateRule(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "main.ts", testdata.ExampleFile)
	args := language.GenerateArgs{Dir: dir}
	r, deps, err := generateRule("main.ts", args)
	if err != nil {
		t.Fatal(err)
	}
	if r == nil {
		t.Fatalf("expected rule")
	}
	if r.Kind() != "ts_project" {
		t.Fatalf("kind %s", r.Kind())
	}
	srcs, ok := r.Attr("srcs").(*build.ListExpr)
	if !ok || len(srcs.List) != 1 || srcs.List[0].(*build.StringExpr).Value != "main.ts" {
		t.Fatalf("srcs not set correctly: %#v", r.Attr("srcs"))
	}
	exp := DepSet{"./foo": true, "./bar": true, "lib": true}
	if !reflect.DeepEqual(deps, exp) {
		t.Fatalf("deps=%v want %v", deps, exp)
	}
}

func TestLanguageGenerateRules(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "main.ts", testdata.ExampleFile)
	l := Language{}
	args := language.GenerateArgs{Dir: dir, RegularFiles: []string{"main.ts"}}
	res := l.GenerateRules(args)
	if len(res.Gen) != 1 {
		t.Fatalf("got %d rules", len(res.Gen))
	}
	if res.Gen[0].Kind() != "ts_project" {
		t.Fatalf("kind %s", res.Gen[0].Kind())
	}
	if len(res.Imports) != 1 {
		t.Fatalf("got %d imports", len(res.Imports))
	}
}

func TestLanguageImports(t *testing.T) {
	r := rule.NewRule("ts_project", "main_ts")
	r.SetAttr("srcs", &build.ListExpr{List: []build.Expr{&build.StringExpr{Value: "main.ts"}}})
	f := &rule.File{Pkg: "foo"}
	specs := Language{}.Imports(&config.Config{}, r, f)
	want := []resolve.ImportSpec{{Lang: "typescript", Imp: path.Join("foo", "main.ts")}}
	if !reflect.DeepEqual(specs, want) {
		t.Fatalf("imports=%v want %v", specs, want)
	}
}
