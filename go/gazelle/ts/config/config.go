// Package tsconfig implements a language for the tsconfig.json.
//
// Typescript files are considered to transitively import
// a tsconfig file for the purposes of gazelle resolution.
package tsconfig

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"

	"github.com/zemn-me/monorepo/go/encoding/jsonc"
)

var defaultRuleInfo = []rule.LoadInfo{
	{
		Name: "@aspect_rules_ts//ts:defs.bzl",
		Symbols: []string{
			"ts_config",
		},
	},
}

const tsconfigExtKey = "typescript.tsconfig"

// ConfigStore tracks tsconfig metadata keyed by repository-relative file path.
type ConfigStore map[string]TsConfigPartial

func ensureConfigStore(c *config.Config) ConfigStore {
	if store, ok := c.Exts[tsconfigExtKey].(ConfigStore); ok {
		return store
	}

	store := make(ConfigStore)
	c.Exts[tsconfigExtKey] = store

	return store
}

// Configs retrieves the shared tsconfig store, returning nil when unavailable.
func Configs(c *config.Config) ConfigStore {
	if c == nil {
		return nil
	}

	store, _ := c.Exts[tsconfigExtKey].(ConfigStore)
	return store
}

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

// an imagined import path for a tsconfig.
// since tsconfigs use relative imports,
// we normalise to paths absolute to the repo.
type ImportPath string

func (i ImportPath) String() string { return string(i) }

func NewImportPath(base string, relPath string) ImportPath {
	return ImportPath(path.Join(base, relPath))
}

// a set of tsconfigs we import
type DepSet map[ImportPath]bool

func NewDepSet(base string, relPaths ...string) (n DepSet) {
	n = make(DepSet, len(relPaths))

	for _, v := range relPaths {
		n[NewImportPath(base, v)] = true
	}

	return
}

func (d DepSet) Strings() (o []string) {
	o = make([]string, 0, len(d))

	for v := range d {
		o = append(o, v.String())
	}
	return
}

type stringList []string

var _ json.Unmarshaler = &stringList{}

func (s *stringList) UnmarshalJSON(b []byte) (err error) {
	var i any

	if err = json.Unmarshal(b, &i); err != nil {
		err = fmt.Errorf("stringList parseJSON: %v", err)
		return
	}

	switch v := i.(type) {
	case string:
		*s = []string{v}
		return
	case []any:
		*s = make([]string, len(v))

		for i, ss := range v {
			var sss string
			var ok bool
			if sss, ok = ss.(string); !ok {
				err = fmt.Errorf("Index %d must be string, instead %T", i, ss)
				return
			}

			(*s)[i] = sss
		}

		return
	}

	err = fmt.Errorf("Value must be string or []string, instead %T", i)

	return
}

func (s stringList) Strings() []string {
	return []string(s)
}

// A partial tsconfig for extracting fields
// relevant to this Gazelle extension.
type TsConfigPartial struct {
	// Relative paths that this tsconfig
	// extends
	Extends stringList

	CompilerOptions CompilerOptionsPartial
}

// CompilerOptionsPartial captures the subset of compiler options we care about.
type CompilerOptionsPartial struct {
	BaseURL string
	Paths   map[string]stringList
}

// PathMappings converts the raw compilerOptions.paths field into a standard
// Go map for downstream consumers.
func (t TsConfigPartial) PathMappings() map[string][]string {
	if len(t.CompilerOptions.Paths) == 0 {
		return nil
	}

	m := make(map[string][]string, len(t.CompilerOptions.Paths))
	for k, v := range t.CompilerOptions.Paths {
		m[k] = v.Strings()
	}

	return m
}

type Language struct{}

// RegisterFlags registers command-line flags used by the extension. This
// method is called once with the root configuration when Gazelle
// starts. RegisterFlags may set an initial values in Config.Exts. When flags
// are set, they should modify these values.
func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {
	ensureConfigStore(c)
}

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
	ensureConfigStore(c)
}

// Name returns the name of the language. This should be a prefix of the
// kinds of rules generated by the language, e.g., "go" for the Go extension
// since it generates "go_library" rules.
func (Language) Name() string { return "tsconfig" }

// Imports returns a list of ImportSpecs that can be used to import the rule
// r. This is used to populate RuleIndex.
//
// If nil is returned, the rule will not be indexed. If any non-nil slice is
// returned, including an empty slice, the rule will be indexed.
func (this Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) (specs []resolve.ImportSpec) {
	// for the tsconfig rule, there can only be
	// one single src.
	//
	// the 'import' of this file is imagined
	// as the absolute location of the file.

	specs = append(specs, resolve.ImportSpec{
		Lang: this.Name(),
		Imp:  path.Join(f.Pkg, r.AttrString("src")),
	})

	return
}

// Embeds returns a list of labels of rules that the given rule embeds. If
// a rule is embedded by another importable rule of the same language, only
// the embedding rule will be indexed. The embedding rule will inherit
// the imports of the embedded rule.
func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }

// Resolve translates imported libraries for a given rule into Bazel
// dependencies. Information about imported libraries is returned for each
// rule generated by language.GenerateRules in
// language.GenerateResult.Imports. Resolve generates a "deps" attribute (or
// the appropriate language-specific equivalent) for each import according to
// language-specific rules and heuristics.
func (l Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	depSet := imports.(DepSet)

	deps := depSet.Strings()

	im := make([]string, len(deps))

	for i, imp := range deps {
		f := ix.FindRulesByImportWithConfig(c, resolve.ImportSpec{
			Lang: l.Name(), Imp: imp,
		}, l.Name())
		im[i] = f[0].Label.String()
	}

	r.SetAttr("deps", im)
}

// Kinds returns a map of maps rule names (kinds) and information on how to
// match and merge attributes that may be found in rules of those kinds. All
// kinds of rules generated for this language may be found here.
func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_config": {
			MatchAny:   true,
			MatchAttrs: []string{"src"},
			NonEmptyAttrs: map[string]bool{
				"deps": true,
				"src":  true,
			},
			MergeableAttrs: map[string]bool{
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
func isTSConfigByName(name string) bool {
	if name == "tsconfig.json" {
		return true
	}

	return strings.HasSuffix(name, ".tsconfig.json")
}

// returns the rule name for given input src name.
func deriveRuleNameFromFileName(fileName string) string {
	if fileName == "tsconfig.json" {
		return "tsconfig"
	}

	return strings.Replace(fileName, ".", "_", -1)
}

// response struct of generateRule
type GenerateRuleResult struct {
	rule    *rule.Rule
	imports DepSet
}

// ParseFile reads and decodes a tsconfig file at filePath.
func ParseFile(filePath string) (conf TsConfigPartial, err error) {
	var f *os.File
	if f, err = os.Open(filePath); err != nil {
		return
	}
	defer f.Close()

	if err = jsonc.NewDecoder(f).Decode(&conf); err != nil {
		err = demystifyJsonParseError(f, err)
	}

	return
}

// attempt to generate a rule for a single TSConfig file.
//
// a nil GenerateRuleResult will be returned if this
// file is not valid for generating rules.
//
// If an error occurs, GenerateRuleResult will not
// necessarily be nil.
func generateRule(fileName string, args language.GenerateArgs) (res *GenerateRuleResult, err error) {
	if !isTSConfigByName(fileName) {
		return
	}

	filePath := path.Join(args.Dir, fileName)

	var conf TsConfigPartial
	if conf, err = ParseFile(filePath); err != nil {
		err = fmt.Errorf("Parse tsconfig JSON: %v", err)
		return
	}

	res = new(GenerateRuleResult)

	r := rule.NewRule(
		/* kind: */ "ts_config",
		/* name */ deriveRuleNameFromFileName(fileName),
	)

	r.SetAttr("src", fileName)

	basePkg := args.Rel
	if args.File != nil {
		basePkg = args.File.Pkg
	}

	res = &GenerateRuleResult{
		rule:    r,
		imports: NewDepSet(basePkg, conf.Extends.Strings()...),
	}

	store := ensureConfigStore(args.Config)
	store[path.Join(args.Rel, fileName)] = conf

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
	return defaultRuleInfo
}

// Fix repairs deprecated usage of language-specific rules in f. This is
// called before the file is indexed. Unless c.ShouldFix is true, fixes
// that delete or rename rules should not be performed.
func (Language) Fix(c *config.Config, f *rule.File) {}

func NewLanguage() language.Language {
	return &Language{}
}
