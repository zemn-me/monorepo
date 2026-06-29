package css

import (
	"flag"
	"fmt"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"

	tsconfig "github.com/zemn-me/monorepo/go/gazelle/ts/config"
)

const (
	cssModuleSuffix    = ".module.css"
	rootTsConfigExtKey = "css.root_tsconfig"
)

var targetNamePattern = regexp.MustCompile(`[^A-Za-z0-9_]+`)

type Language struct{}

func (Language) Name() string { return "css" }

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return nil }
func (Language) Configure(c *config.Config, rel string, f *rule.File) {
	if rel == "" {
		ensureRootTsConfig(c)
	}
}
func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }

func ensureRootTsConfig(c *config.Config) tsconfig.TsConfigPartial {
	if existing, ok := c.Exts[rootTsConfigExtKey].(tsconfig.TsConfigPartial); ok {
		return existing
	}

	conf, err := tsconfig.ParseFile(filepath.Join(c.RepoRoot, "tsconfig.json"))
	if err != nil {
		panic(fmt.Sprintf("load tsconfig.json: %v", err))
	}

	c.Exts[rootTsConfigExtKey] = conf
	return conf
}

func isCSSModuleFile(name string) bool {
	return strings.HasSuffix(name, cssModuleSuffix)
}

func cssModuleRuleName(name string) string {
	name = strings.TrimSpace(name)
	name = targetNamePattern.ReplaceAllString(name, "_")
	name = strings.Trim(name, "_")
	if name == "" {
		return "css_module"
	}
	return name
}

func moduleSpecsForRepoPath(conf tsconfig.TsConfigPartial, repoPath string) []string {
	repoPath = strings.TrimPrefix(repoPath, "./")
	repoPath = path.Clean(repoPath)
	if repoPath == "." || repoPath == "" {
		return nil
	}

	mappings := conf.PathMappings()
	if len(mappings) == 0 {
		return nil
	}

	var baseURL string
	if conf.CompilerOptions.BaseURL != "" && conf.CompilerOptions.BaseURL != "." {
		baseURL = path.Clean(conf.CompilerOptions.BaseURL)
	}

	specs := make(map[string]struct{})
	candidateNoBase := repoPath
	if baseURL != "" {
		if strings.HasPrefix(repoPath, baseURL+"/") {
			candidateNoBase = strings.TrimPrefix(repoPath, baseURL+"/")
		} else if repoPath == baseURL {
			candidateNoBase = ""
		} else {
			return nil
		}
	}

	for pattern, replacements := range mappings {
		for _, replacement := range replacements {
			middle, ok := matchReplacementPattern(replacement, candidateNoBase)
			if !ok {
				continue
			}
			specs[applyPattern(pattern, middle)] = struct{}{}
		}
	}

	if len(specs) == 0 {
		return nil
	}

	out := make([]string, 0, len(specs))
	for spec := range specs {
		out = append(out, spec)
	}
	sort.Strings(out)
	return out
}

func matchReplacementPattern(replacement, value string) (string, bool) {
	first := strings.Index(replacement, "*")
	last := strings.LastIndex(replacement, "*")
	if first == -1 {
		if value != replacement {
			return "", false
		}
		return "", true
	}

	prefix := replacement[:first]
	suffix := replacement[last+1:]
	if !strings.HasPrefix(value, prefix) || !strings.HasSuffix(value, suffix) {
		return "", false
	}
	middle := value[len(prefix) : len(value)-len(suffix)]
	return middle, true
}

func applyPattern(pattern, middle string) string {
	first := strings.Index(pattern, "*")
	last := strings.LastIndex(pattern, "*")
	if first == -1 {
		return pattern
	}
	return pattern[:first] + middle + pattern[last+1:]
}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"css_module": {
			MergeableAttrs: map[string]bool{
				"src":        true,
				"visibility": true,
			},
			NonEmptyAttrs: map[string]bool{
				"src": true,
			},
		},
	}
}

func (Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{
		{Name: "//css/module:rules.bzl", Symbols: []string{"css_module"}},
	}
}

func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	if f == nil || r.Kind() != "css_module" {
		return nil
	}

	src := r.AttrString("src")
	if src == "" {
		return nil
	}

	rootConfig := ensureRootTsConfig(c)
	repoPath := path.Join(f.Pkg, src)
	specs := append([]string{repoPath}, moduleSpecsForRepoPath(rootConfig, repoPath)...)
	importSpecs := make([]resolve.ImportSpec, 0, len(specs))
	seen := make(map[string]struct{}, len(specs))
	for _, spec := range specs {
		if _, ok := seen[spec]; ok {
			continue
		}
		seen[spec] = struct{}{}
		importSpecs = append(importSpecs, resolve.ImportSpec{
			Lang: "css",
			Imp:  spec,
		})
	}
	return importSpecs
}

func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
}

func (Language) Fix(c *config.Config, f *rule.File) {}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	var cssModules []string
	for _, f := range args.RegularFiles {
		if isCSSModuleFile(f) {
			cssModules = append(cssModules, f)
		}
	}
	if len(cssModules) == 0 {
		return language.GenerateResult{}
	}

	sort.Strings(cssModules)
	gen := make([]*rule.Rule, 0, len(cssModules))
	imports := make([]interface{}, 0, len(cssModules))
	for _, cssModule := range cssModules {
		cssRule := rule.NewRule("css_module", cssModuleRuleName(cssModule))
		cssRule.SetAttr("src", cssModule)
		cssRule.SetAttr("visibility", []string{"//:__subpackages__"})
		gen = append(gen, cssRule)
		imports = append(imports, nil)
	}

	return language.GenerateResult{
		Gen:     gen,
		Imports: imports,
	}
}

func (Language) ApparentLoads(moduleToApparentName func(string) string) []rule.LoadInfo {
	return []rule.LoadInfo{
		{Name: "//css/module:rules.bzl", Symbols: []string{"css_module"}},
	}
}

func NewLanguage() language.Language { return &Language{} }
