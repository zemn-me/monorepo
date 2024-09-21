package ts

import (
	"errors"
	"flag"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	"github.com/bazelbuild/buildtools/build"

	js "github.com/zemn-me/monorepo/go/gazelle/js"
	"github.com/zemn-me/monorepo/go/ts"
)

type Language struct{}

// Name returns the name of the language.
func (l Language) Name() string { return "typescript" }

// RegisterFlags registers command-line flags used by the extension.
func (l Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}

// CheckFlags validates the configuration after command line flags are parsed.
func (l Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error { return nil }

// KnownDirectives returns a list of directive keys that this Configurer can interpret.
func (l Language) KnownDirectives() []string { return []string{} }

// Configure modifies the configuration using directives and other information extracted from a build file.
func (l Language) Configure(c *config.Config, rel string, f *rule.File) {
	// Inherit JS config
}

func compiledFileName(tsFilePath string) string {
	if !strings.HasSuffix(tsFilePath, ".ts") && !strings.HasSuffix(tsFilePath, ".tsx") {
		return tsFilePath
	}
	return strings.TrimSuffix(tsFilePath, filepath.Ext(tsFilePath)) + ".js"
}

func TsImportsForFileModule(pkg js.PackageJsonPartial, filePath string) []string {
	return pkg.ResolveJSModule(compiledFileName(filePath))
}

// Imports returns a list of ImportSpecs that can be used to import the rule r.
func (l Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	srcsAttr := r.Attr("srcs")
	srcs, ok := srcsAttr.(*build.ListExpr)
	if !ok {
		return nil
	}

	var specs []resolve.ImportSpec

	for _, srcExpr := range srcs.List {
		stringExpr, ok := srcExpr.(*build.StringExpr)
		if !ok {
			continue
		}
		src := stringExpr.Value
		importSymbols := TsImportsForFileModule(c.Exts["javascript"].(js.PackageJsonPartial), path.Join(f.Pkg, src))
		for _, importSymbol := range importSymbols {
			specs = append(specs, resolve.ImportSpec{
				Lang: l.Name(),
				Imp:  importSymbol,
			})
			// Also include JS language
			specs = append(specs, resolve.ImportSpec{
				Lang: js.Language{}.Name(),
				Imp:  importSymbol,
			})
		}
	}

	return specs
}

// Embeds returns a list of labels of rules that the given rule embeds.
func (l Language) Embeds(r *rule.Rule, from label.Label) []label.Label {
	return nil
}

const panicInsteadOfWarn = true

func maybePanic(str string) {
	if panicInsteadOfWarn {
		panic(str)
	}
	fmt.Println(str)
}

func FindRuleWithOverridePreference(c *config.Config, idx *resolve.RuleIndex, imp resolve.ImportSpec, lang string, from label.Label) (label.Label, error) {
	if l, ok := resolve.FindRuleWithOverride(c, imp, lang); ok {
		return l, nil
	}

	var errs []error
	errs = append(errs, fmt.Errorf("not present in override index: %s", imp.Imp))

	matches := idx.FindRulesByImportWithConfig(c, imp, lang)
	if len(matches) > 0 {
		return matches[0].Label, nil
	}

	errs = append(errs, fmt.Errorf("not present in import index: %s", imp.Imp))

	err := fmt.Errorf("in %s/%s: %v", from.Pkg, from.Name, errors.Join(errs...))

	return label.Label{}, err
}

func TSFindRuleWithOverridePreference(c *config.Config, idx *resolve.RuleIndex, imp resolve.ImportSpec, from label.Label) (label.Label, error) {
	l, err := FindRuleWithOverridePreference(c, idx, imp, "javascript", from)
	if err == nil {
		return l, nil
	}

	var errs []error
	errs = append(errs, err)

	l, err = FindRuleWithOverridePreference(c, idx, imp, "typescript", from)
	if err == nil {
		return l, nil
	}

	errs = append(errs, err)

	return label.Label{}, errors.Join(errs...)
}

func ResolveImportSetToTagList(c *config.Config, importSet []string, ix *resolve.RuleIndex, from label.Label) []build.Expr {
	var exprs []build.Expr

	for _, s := range importSet {
		label, err := TSFindRuleWithOverridePreference(c, ix, resolve.ImportSpec{
			Lang: "javascript",
			Imp:  s,
		}, from)
		if err != nil {
			maybePanic(err.Error())
			continue
		}

		exprs = append(exprs, &build.StringExpr{
			Value: label.String(),
		})
	}

	return exprs
}

// Resolve translates imported libraries for a given rule into Bazel dependencies.
func (l Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	if r.Kind() != "ts_project" && r.Kind() != "jest_test" {
		return
	}

	depSet, ok := imports.(js.DepSet)
	if !ok {
		return
	}

	var importTags []build.Expr
	var assetTags []string

	for dep := range depSet {
		builtin := js.ResolveNonLocalImportTags(c.Exts["javascript"].(js.PackageJsonPartial), dep, true)
		if len(builtin) > 0 {
			for _, tag := range builtin {
				importTags = append(importTags, &build.StringExpr{Value: tag})
			}
			continue
		}

		if !strings.HasSuffix(dep, ".js") {
			// Must be asset if not module and not .js
			assetTags = append(assetTags, dep)
			continue
		}

		label, err := TSFindRuleWithOverridePreference(c, ix, resolve.ImportSpec{
			Lang: "javascript",
			Imp:  dep,
		}, from)
		if err != nil {
			maybePanic(err.Error())
			continue
		}

		importTags = append(importTags, &build.StringExpr{Value: label.String()})
	}

	if len(importTags) > 0 {
		r.SetAttr("deps", &build.ListExpr{
			List: importTags,
		})
	}

	if len(assetTags) > 0 {
		r.SetAttr("assets", ResolveImportSetToTagList(c, assetTags, ix, from))
	}
}

// Kinds returns a map of rule names (kinds) and information on how to match and merge attributes.
func (l Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_project": {
			MatchAttrs: []string{"srcs"},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
			MergeableAttrs: map[string]bool{
				"srcs": true,
			},
			ResolveAttrs: map[string]bool{
				"deps":   true,
				"assets": true,
			},
		},
		"jest_test": {
			MatchAttrs: []string{"srcs"},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
			MergeableAttrs: map[string]bool{
				"srcs": true,
			},
			ResolveAttrs: map[string]bool{
				"deps": true,
			},
		},
	}
}

func isTsByFileName(name string) bool {
	return strings.HasSuffix(name, ".ts") || strings.HasSuffix(name, ".tsx")
}

func deriveRuleNameFromFileName(fileName string) string {
	return strings.ReplaceAll(fileName, ".", "_")
}

// GenerateRules extracts build metadata from source files in a directory.
func (l Language) GenerateRules(args language.GenerateArgs) (res language.GenerateResult) {
	tsFiles := make([]string, 0, len(args.RegularFiles))

	for _, f := range args.RegularFiles {
		if isTsByFileName(f) {
			tsFiles = append(tsFiles, f)
		}
	}

	if len(tsFiles) == 0 {
		return
	}

	for _, f := range tsFiles {
		deps := make(js.DepSet)
		imports, err := ts.ExtractImports(filepath.Join(args.Dir, f))
		if err != nil {
			panic(err)
		}

		if strings.HasSuffix(f, ".tsx") {
			imports = append(imports, []byte("@types/react"), []byte("react"))
		}

		for _, i := range imports {
			deps[string(i)] = true
		}

		r := rule.NewRule("ts_project", deriveRuleNameFromFileName(f))
		r.SetAttr("srcs", &build.ListExpr{
			List: []build.Expr{&build.StringExpr{Value: f}},
		})
		r.SetAttr("visibility", &build.ListExpr{
			List: []build.Expr{&build.StringExpr{Value: "//:__subpackages__"}},
		})

		res.Gen = append(res.Gen, r)
		res.Imports = append(res.Imports, deps)

		selfImport := compiledFileName(filepath.Join(
			"#root",
			filepath.Join(args.Rel, f),
		))

		if strings.HasSuffix(f, "_test.ts") || strings.HasSuffix(f, "_test.tsx") {
			tr := rule.NewRule("jest_test", deriveRuleNameFromFileName(f)+"_test")
			tr.SetAttr("srcs", &build.ListExpr{
				List: []build.Expr{&build.StringExpr{Value: compiledFileName(f)}},
			})

			testDeps := make(js.DepSet)
			testDeps[selfImport] = true

			res.Gen = append(res.Gen, tr)
			res.Imports = append(res.Imports, testDeps)
		}
	}

	return
}

// Loads returns .bzl files and symbols they define.
// Even though it's deprecated, we need to implement it to satisfy the interface.
func (l Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    "//ts:rules.bzl",
			Symbols: []string{"ts_lint", "ts_project", "jest_test"},
		},
	}
}

// ApparentLoads returns .bzl files and symbols they define.
func (l Language) ApparentLoads(moduleToApparentName func(string) string) []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    "//ts:rules.bzl",
			Symbols: []string{"ts_lint", "ts_project", "jest_test"},
		},
	}
}

// Fix repairs deprecated usage of language-specific rules in the file.
func (l Language) Fix(c *config.Config, f *rule.File) {
	for _, r := range f.Rules {
		if r.Kind() != "ts_project" {
			continue
		}

		if r.Attr("srcs") != nil {
			continue
		}

		r.Delete()
	}
}

func NewLanguage() language.Language {
	return &Language{}
}
