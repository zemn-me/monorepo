package ts

import (
	"flag"
	"os"
	"path"
	"regexp"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	"github.com/bazelbuild/buildtools/build"
)

// Language implements a very small Gazelle extension that can
// generate ts_project rules for .ts and .tsx files.
type Language struct{}

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return []string{} }
func (Language) Configure(c *config.Config, rel string, f *rule.File)         {}
func (Language) Name() string                                                 { return "typescript" }

// regex used to find imported modules.
var importRe = regexp.MustCompile(`(?m)^(?:import|export)[^\n]*?from\s+["']([^"']+)["']`)

// listImports returns all import strings in a TypeScript file.
func listImports(filename string) ([]string, error) {
	b, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	matches := importRe.FindAllSubmatch(b, -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			out = append(out, string(m[1]))
		}
	}
	return out, nil
}

type DepSet map[string]bool

func isTsFile(name string) bool {
	return path.Ext(name) == ".ts" || path.Ext(name) == ".tsx"
}

func ruleNameFromFile(name string) string {
	return strings.ReplaceAll(name, ".", "_")
}

func generateRule(fileName string, args language.GenerateArgs) (*rule.Rule, DepSet, error) {
	if !isTsFile(fileName) {
		return nil, nil, nil
	}
	filePath := path.Join(args.Dir, fileName)
	imports, err := listImports(filePath)
	if err != nil {
		return nil, nil, err
	}
	deps := make(DepSet)
	for _, i := range imports {
		deps[i] = true
	}
	r := rule.NewRule("ts_project", ruleNameFromFile(fileName))
	r.SetAttr("srcs", &build.ListExpr{List: []build.Expr{&build.StringExpr{Value: fileName}}})
	return r, deps, nil
}

func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	var srcs *build.ListExpr
	var ok bool
	if srcs, ok = r.Attr("srcs").(*build.ListExpr); !ok {
		return nil
	}
	var specs []resolve.ImportSpec
	for _, src := range srcs.List {
		specs = append(specs, resolve.ImportSpec{
			Lang: "typescript",
			Imp:  path.Join(f.Pkg, src.(*build.StringExpr).Value),
		})
	}
	return specs
}

func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }

func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	deps := make([]string, 0)
	for dep := range imports.(DepSet) {
		matches := ix.FindRulesByImportWithConfig(c, resolve.ImportSpec{Lang: "typescript", Imp: dep}, "typescript")
		if len(matches) == 0 {
			continue
		}
		deps = append(deps, matches[0].Label.String())
	}
	if len(deps) > 0 {
		r.SetAttr("deps", deps)
	}
}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_project": {
			MatchAny:   true,
			MatchAttrs: []string{"srcs"},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
			MergeableAttrs: map[string]bool{
				"srcs": true,
				"deps": true,
			},
			ResolveAttrs: map[string]bool{
				"deps": true,
			},
		},
	}
}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	var result language.GenerateResult
	for _, f := range args.RegularFiles {
		r, deps, err := generateRule(f, args)
		if err != nil {
			panic(err)
		}
		if r == nil {
			continue
		}
		result.Gen = append(result.Gen, r)
		result.Imports = append(result.Imports, deps)
	}
	return result
}

func (Language) Loads() []rule.LoadInfo {
	panic("Call ApparentLoads")
}

var _ language.ModuleAwareLanguage = Language{}

func (Language) ApparentLoads(moduleToApparentName func(string) string) []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    "//ts:rules.bzl",
			Symbols: []string{"ts_project"},
		},
	}
}

func (Language) Fix(c *config.Config, f *rule.File) {}

func NewLanguage() language.Language { return &Language{} }
