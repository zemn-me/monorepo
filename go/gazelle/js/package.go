package js

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
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

	parse "github.com/tdewolff/parse/v2"
	js "github.com/tdewolff/parse/v2/js"

	"github.com/zemn-me/monorepo/go/encoding/jsonc"
)

func demystifyJsonParseError(f *os.File, err error) error {
	var se *json.SyntaxError
	var ok bool
	if se, ok = err.(*json.SyntaxError); !ok {
		return err
	}

	const nContext = 10 // bytes
	start := se.Offset - nContext
	if start < 0 {
		start = 0
	}

	_, err = f.Seek(start, io.SeekStart)
	var context [nContext]byte

	n, err := f.Read(context[:])
	if err != nil {
		return err
	}

	contextSl := context[:n]

	return fmt.Errorf("%v ~ error near '%+s' (offset %d)", err, contextSl, se.Offset)
}

type PackageJsonPartial struct {
	// Pattern matchers and rewrites for package.json
	// See: https://nodejs.org/api/packages.html#subpath-imports
	Imports map[string]string

	Dependencies map[string]string

	DevDependencies map[string]string
}

func (p PackageJsonPartial) HasDep(packageName string) bool {
	_, a := p.Dependencies[packageName]
	_, b := p.DevDependencies[packageName]

	return a || b
}

type Language struct{}

// RegisterFlags registers command-line flags used by the extension. This
// method is called once with the root configuration when Gazelle
// starts. RegisterFlags may set an initial values in Config.Exts. When flags
// are set, they should modify these values.
func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}

// CheckFlags validates the configuration after command line flags are parsed.
// This is called once with the root configuration when Gazelle starts.
// CheckFlags may set default values in flags or make implied changes.
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error { return nil }

// KnownDirectives returns a list of directive keys that this Configurer can
// interpret. Gazelle prints errors for directives that are not recoginized by
// any Configurer.
func (Language) KnownDirectives() []string { return []string{} }

// Configure modifies the configuration using directives and other information
// extracted from a build file. Configure is called in each directory.
//
// c is the configuration for the current directory. It starts out as a copy
// of the configuration for the parent directory.
//
// rel is the slash-separated relative path from the repository root to
// the current directory. It is "" for the root directory itself.
//
// f is the build file for the current directory or nil if there is no
// existing build file.
func (Language) Configure(c *config.Config, rel string, f *rule.File) {
	if _, ok := c.Exts["javascript"]; ok {
		return
	}

	// this layout is for one canonical package.json, which is what I use.
	fPkgJson, err := os.Open(path.Join(path.Dir(f.Path), "package.json"))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return
		}
		panic(err)
	}

	var info PackageJsonPartial

	if err = jsonc.NewDecoder(fPkgJson).Decode(&info); err != nil {
		panic(err)
	}

	c.Exts["javascript"] = info
}

// Name returns the name of the language. This should be a prefix of the
// kinds of rules generated by the language, e.g., "go" for the Go extension
// since it generates "go_library" rules.
func (Language) Name() string { return "javascript" }

var importFromPatReplacer = regexp.MustCompile("(.*)/\\*")

// gives a list of possible import symbols for a given file module
// we only support esm, so this is pretty simple.
//
// filePath must be relative to the repo root.
func JsImportsForFileModule(c *config.Config, filePath string) (symbols []string) {
	for importFromPat, importToPat := range c.Exts["javascript"].(PackageJsonPartial).Imports {
		if importToPat != "./*" || !strings.HasSuffix(importFromPat, "*") {
			panic(
				fmt.Sprintf("subpath imports should be based at root (%+q), instead %+q; or rewrite pattern %+q did not end in *", "./*", importToPat, importFromPat),
			)
		}

		symbols = append(symbols, path.Join(importFromPat, "..", filePath))
	}

	return
}

// Imports returns a list of ImportSpecs that can be used to import the rule
// r. This is used to populate RuleIndex.
//
// If nil is returned, the rule will not be indexed. If any non-nil slice is
// returned, including an empty slice, the rule will be indexed.
func (this Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) (specs []resolve.ImportSpec) {
	for _, src := range r.Attr("srcs").(*build.ListExpr).List {
		for _, importSymbol := range JsImportsForFileModule(c, path.Join(f.Pkg, src.(*build.StringExpr).Value)) {
			specs = append(specs, resolve.ImportSpec{
				Lang: this.Name(),
				Imp:  importSymbol,
			})
		}
	}

	return
}

// Embeds returns a list of labels of rules that the given rule embeds. If
// a rule is embedded by another importable rule of the same language, only
// the embedding rule will be indexed. The embedding rule will inherit
// the imports of the embedded rule.
func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }

func resolveBuiltinImportTags(pkg string) (imports *[]string) {
	switch {
	case strings.HasPrefix(pkg, "node:"):
		return &[]string{}
	}

	return nil
}

var reExtractModule = regexp.MustCompile("@[^/]+/[^/]+|[^/]+")

// for a given import string, which may be a node_modules related import string
// returns the module name.
//
// For example, eslint-plugin-react/configs/recommended would be
// eslint-plugin-react, but @react/dom/index.js would be @react/dom.
func nodeModulesModuleFromImportString(importString string) (moduleName string) {
	return reExtractModule.FindString(importString)
}

func resolveNodeModulesImportTags(pkgjson PackageJsonPartial, pkg string) (imports *[]string) {
	moduleName := nodeModulesModuleFromImportString(pkg)
	if !pkgjson.HasDep(moduleName) {
		return nil
	}

	return &[]string{
		fmt.Sprintf("//:node_modules/%s", moduleName),
	}
}

func resolveNonLocalImportTags(pkgjson PackageJsonPartial, pkg string) (imports *[]string) {
	if imports = resolveBuiltinImportTags(pkg); imports != nil {
		return
	}
	if imports = resolveNodeModulesImportTags(pkgjson, pkg); imports != nil {
		return
	}

	return
}

type DepSet map[string]bool

// Resolve translates imported libraries for a given rule into Bazel
// dependencies. Information about imported libraries is returned for each
// rule generated by language.GenerateRules in
// language.GenerateResult.Imports. Resolve generates a "deps" attribute (or
// the appropriate language-specific equivalent) for each import according to
// language-specific rules and heuristics.
func (l Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	var im []string

	for dep := range imports.(DepSet) {
		builtin := resolveNonLocalImportTags(c.Exts["javascript"].(PackageJsonPartial), dep)
		if builtin != nil {
			for _, tag := range *builtin {
				im = append(im, tag)
			}
			continue
		}

		f := ix.FindRulesByImportWithConfig(c, resolve.ImportSpec{
			Lang: l.Name(), Imp: dep,
		}, l.Name())

		if len(f) == 0 {
			panic(fmt.Sprintf("Can’t work out an appropriate way to import %+q! in %+q", dep, from))
		}
		im = append(im, f[0].Label.String())
	}

	r.SetAttr("deps", im)
}

// Kinds returns a map of maps rule names (kinds) and information on how to
// match and merge attributes that may be found in rules of those kinds. All
// kinds of rules generated for this language may be found here.
func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"js_library": {
			MatchAny:   true,
			MatchAttrs: []string{"src"},
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

// tsconfigByName returns true if the name of the
// file indiciates that it is a tsconfig file.
func isJsFilebyName(name string) bool {
	return strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".mjs")
}

// returns the rule name for given input src name.
func deriveRuleNameFromFileName(fileName string) string {
	return strings.Replace(fileName, ".", "_", -1)
}

// response struct of generateRule
type GenerateRuleResult struct {
	rule    *rule.Rule
	imports DepSet
}

type jsImportLister struct {
	importList [][]byte
}

var _ js.IVisitor = &jsImportLister{}

func (l *jsImportLister) Enter(n js.INode) js.IVisitor {
	switch v := n.(type) {
	case *js.ImportStmt:
		l.importList = append(l.importList, bytes.Trim(v.Module, "\"'"))
	default:
	}

	return l
}

func (l *jsImportLister) Exit(n js.INode) {
}

func listImports(mod *js.AST) [][]byte {
	var j jsImportLister
	js.Walk(&j, &mod.BlockStmt)

	return j.importList
}

// attempt to generate a rule for a single TSConfig file.
//
// a nil GenerateRuleResult will be returned if this
// file is not valid for generating rules.
//
// If an error occurs, GenerateRuleResult will not
// necessarily be nil.
func generateRule(fileName string, args language.GenerateArgs) (res *GenerateRuleResult, err error) {
	if !isJsFilebyName(fileName) {
		return
	}
	filePath := path.Join(args.Dir, fileName)

	var f *os.File
	if f, err = os.Open(filePath); err != nil {
		return
	}

	module, err := js.Parse(parse.NewInput(f), js.Options{})
	if err != nil {
		return
	}

	imports := listImports(module)

	var deps DepSet = make(DepSet)

	for _, i := range imports {
		deps[string(i)] = true
	}

	r := rule.NewRule(
		/* kind: */ "js_library",
		/* name */ deriveRuleNameFromFileName(fileName),
	)

	r.SetAttr("srcs", &build.ListExpr{List: []build.Expr{
		&build.StringExpr{Value: fileName},
	}})

	res = &GenerateRuleResult{
		rule:    r,
		imports: deps,
	}

	return
}

// abstract version of GenerateRules that may return errors
func generateRules(args language.GenerateArgs) (result language.GenerateResult, err error) {
	var gen *GenerateRuleResult
	for _, fileName := range args.RegularFiles {
		gen, err = generateRule(fileName, args)
		if err != nil {
			err = fmt.Errorf("Generate rule for %+q: %v",
				path.Join(args.Dir, fileName),
				err,
			)
			return
		}

		if gen == nil {
			continue
		}

		result.Gen = append(result.Gen, gen.rule)
		result.Imports = append(result.Imports, gen.imports)
	}

	return
}

// GenerateRules extracts build metadata from source files in a directory.
// GenerateRules is called in each directory where an update is requested
// in depth-first post-order.
//
// args contains the arguments for GenerateRules. This is passed as a
// struct to avoid breaking implementations in the future when new
// fields are added.
//
// A GenerateResult struct is returned. Optional fields may be added to this
// type in the future.
//
// Any non-fatal errors this function encounters should be logged using
// log.Print.
func (Language) GenerateRules(args language.GenerateArgs) (result language.GenerateResult) {
	var err error
	result, err = generateRules(args)
	if err != nil {
		panic(err)
	}

	return
}

// Loads returns .bzl files and symbols they define. Every rule generated by
// GenerateRules, now or in the past, should be loadable from one of these
// files.
//
// Deprecated: Implement ModuleAwareLanguage's ApparentLoads.
func (Language) Loads() []rule.LoadInfo {
	panic("Call ApparentLoads")
}

var _ language.ModuleAwareLanguage = Language{}

func (Language) ApparentLoads(moduleToApparentName func(string) string) []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    "//js:rules.bzl",
			Symbols: []string{"js_binary", "js_test", "js_library"},
		},
	}
}

// Fix repairs deprecated usage of language-specific rules in f. This is
// called before the file is indexed. Unless c.ShouldFix is true, fixes
// that delete or rename rules should not be performed.
func (Language) Fix(c *config.Config, f *rule.File) {}

func NewLanguage() language.Language {
	return &Language{}
}