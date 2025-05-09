// Package bazel implements a Gazelle Language for bazel.
package bazel

import (
	"flag"
	"path/filepath"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
)

const lib_path = "//bzl:rules.bzl"

const kind_name = "bazel_lint"

// symbol used for imports
type ImportLib struct{}

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
func (Language) Configure(c *config.Config, rel string, f *rule.File) {}

// Name returns the name of the language. This should be a prefix of the
// kinds of rules generated by the language, e.g., "go" for the Go extension
// since it generates "go_library" rules.
func (Language) Name() string { return "bazel" }

// Imports returns a list of ImportSpecs that can be used to import the rule
// r. This is used to populate RuleIndex.
//
// If nil is returned, the rule will not be indexed. If any non-nil slice is
// returned, including an empty slice, the rule will be indexed.
func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	return []resolve.ImportSpec{}
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
func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	switch imports.(type) {
	case ImportLib:
	}
}

// Kinds returns a map of maps rule names (kinds) and information on how to
// match and merge attributes that may be found in rules of those kinds. All
// kinds of rules generated for this language may be found here.
func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		kind_name: {},
	}
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
func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	var files []string

	for _, v := range args.RegularFiles {
		ext := filepath.Ext(v)
		switch {
		case v == "BUILD":
			fallthrough
		case ext == ".bzl":
			fallthrough
		case ext == ".bazel":
			break
		default:
			continue
		}

		files = append(files, v)
	}

	if len(files) < 1 {
		return language.GenerateResult{}
	}

	r := rule.NewRule(
		/* kind: */ kind_name,
		/* name: */ kind_name,
	)

	r.SetAttr("srcs", files)

	return language.GenerateResult{
		Gen: []*rule.Rule{r},
		Imports: []interface{}{
			ImportLib{},
		},
	}
}

// Loads returns .bzl files and symbols they define. Every rule generated by
// GenerateRules, now or in the past, should be loadable from one of these
// files.
//
// Deprecated: Implement ModuleAwareLanguage's ApparentLoads.
func (Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{
		{
			Name:    lib_path,
			Symbols: []string{kind_name},
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
