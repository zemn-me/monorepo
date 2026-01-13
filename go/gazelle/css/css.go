package css

import (
	"flag"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
)

// Language indexes CSS module files so other languages (e.g. TypeScript)
// can depend on them via cross-language imports.
type Language struct{}

func (Language) Name() string { return "css" }

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return nil }

func (Language) Configure(c *config.Config, rel string, f *rule.File) {}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"css_library": {
			MergeableAttrs: map[string]bool{
				"srcs": true,
			},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
		},
	}
}

func (Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    "//css:rules.bzl",
			Symbols: []string{"css_library"},
		},
	}
}

func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }
func (Language) Fix(c *config.Config, f *rule.File)                  {}

// GenerateRules collects `.module.css` files in a package and exposes them
// via a css_library rule.
func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	var srcs []string
	for _, f := range args.RegularFiles {
		if strings.HasSuffix(f, ".module.css") {
			srcs = append(srcs, f)
		}
	}
	if len(srcs) == 0 {
		return language.GenerateResult{}
	}

	sort.Strings(srcs)

	r := rule.NewRule("css_library", filepath.Base(args.Dir))
	r.SetAttr("srcs", srcs)
	r.SetAttr("visibility", []string{"//:__subpackages__"})

	return language.GenerateResult{
		Gen: []*rule.Rule{r},
	}
}

// Imports indexes each CSS module by its repo-relative path so other
// languages can resolve them.
func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	srcs := r.AttrStrings("srcs")
	if len(srcs) == 0 {
		return nil
	}

	specs := make([]resolve.ImportSpec, 0, len(srcs))
	for _, src := range srcs {
		specs = append(specs, resolve.ImportSpec{
			Lang: "css",
			Imp:  path.Join(f.Pkg, src),
		})
	}
	return specs
}

func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
}

func NewLanguage() language.Language { return &Language{} }
