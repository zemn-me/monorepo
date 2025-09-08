package ts

import (
	"flag"
	"os"
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
)

const allowPath = "go/gazelle/ts"

var reExtractModule = regexp.MustCompile("@[^/]+/[^/]+|[^/]+")

// Language implements a very small Gazelle extension that
// generates ts_project rules for TypeScript files.
type Language struct{}

func (Language) Name() string { return "typescript" }

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return []string{} }
func (Language) Configure(c *config.Config, rel string, f *rule.File)         {}
func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label          { return nil }
func (Language) Fix(c *config.Config, f *rule.File)                           {}

func isAllowed(rel string) bool {
	return rel == allowPath || strings.HasPrefix(rel, allowPath+"/")
}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_project": {
			MatchAny: true,
			MergeableAttrs: map[string]bool{
				"srcs": true,
				"deps": true,
			},
			ResolveAttrs: map[string]bool{
				"deps": true,
			},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
		},
	}
}

func (Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{{Name: "//ts:rules.bzl", Symbols: []string{"ts_project"}}}
}

func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	return nil
}

func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	if !isAllowed(args.Rel) {
		return language.GenerateResult{}
	}

	var srcs []string
	for _, f := range args.RegularFiles {
		if strings.HasSuffix(f, ".ts") || strings.HasSuffix(f, ".tsx") {
			srcs = append(srcs, f)
		}
	}
	if len(srcs) == 0 {
		return language.GenerateResult{}
	}

	name := filepath.Base(args.Dir)
	r := rule.NewRule("ts_project", name)
	r.SetAttr("srcs", srcs)

	depSet := make(map[string]bool)
	re := regexp.MustCompile(`(?m)from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)`)
	for _, src := range srcs {
		data, err := os.ReadFile(filepath.Join(args.Dir, src))
		if err != nil {
			continue
		}
		matches := re.FindAllStringSubmatch(string(data), -1)
		for _, m := range matches {
			mod := m[1]
			if mod == "" {
				mod = m[2]
			}
			if strings.HasPrefix(mod, ".") {
				continue
			}
			moduleName := reExtractModule.FindString(mod)
			depSet["//:node_modules/"+moduleName] = true
		}
	}

	var deps []string
	for d := range depSet {
		deps = append(deps, d)
	}
	sort.Strings(deps)
	if len(deps) > 0 {
		r.SetAttr("deps", deps)
	}

	return language.GenerateResult{
		Gen:     []*rule.Rule{r},
		Imports: []interface{}{nil},
	}
}

func NewLanguage() language.Language { return &Language{} }
