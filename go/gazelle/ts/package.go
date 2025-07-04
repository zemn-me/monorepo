package ts

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path"
	"regexp"
	"sort"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/label"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/repo"
	"github.com/bazelbuild/bazel-gazelle/resolve"
	"github.com/bazelbuild/bazel-gazelle/rule"
	build "github.com/bazelbuild/buildtools/build"

	gazellejs "github.com/zemn-me/monorepo/go/gazelle/js"
)

// Language implements a gazelle language for TypeScript.
type Language struct{}

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return []string{} }
func (Language) Configure(c *config.Config, rel string, f *rule.File)         {}
func (Language) Name() string                                                 { return "typescript" }

// Regular expression for matching import statements.
var importRe = regexp.MustCompile(`(?m)^\s*(?:import|export).*?from\s+["']([^"']+)["']`)
var tsExtRe = regexp.MustCompile(`\.tsx?$`)
var moduleRe = regexp.MustCompile(`@[^/]+/[^/]+|[^/]+`)

const allowPrefix = "ts/"

func inDisallowlist(pkg string) bool {
	if strings.HasPrefix(pkg, allowPrefix) {
		rest := strings.TrimPrefix(pkg, allowPrefix)
		if rest != "" && !strings.Contains(rest, "/") {
			return true
		}
	}
	return false
}

func inAllowlist(pkg string) bool {
	if pkg == "ts" {
		return true
	}
	if !strings.HasPrefix(pkg, allowPrefix) {
		return false
	}
	return !inDisallowlist(pkg)
}

func nodeModulesModuleFromImportString(s string) string {
	return moduleRe.FindString(s)
}

// listImports returns a slice of import strings from the given TypeScript file.
func listImports(filePath string) ([]string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var imports []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if m := importRe.FindStringSubmatch(line); m != nil {
			imports = append(imports, m[1])
		}
	}
	return imports, scanner.Err()
}

// Imports is unused for now and returns nil so rules are not indexed.
func importAlias(pkg, src string) string {
	alias := fmt.Sprintf("#root/%s/%s", pkg, src)
	alias = tsExtRe.ReplaceAllString(alias, ".js")
	return alias
}

func ruleSrcs(c *config.Config, f *rule.File, r *rule.Rule) []string {
	if list, ok := r.Attr("srcs").(*build.ListExpr); ok {
		var srcs []string
		for _, s := range list.List {
			if se, ok := s.(*build.StringExpr); ok {
				srcs = append(srcs, se.Value)
			}
		}
		if len(srcs) > 0 {
			return srcs
		}
	}

	dir := path.Join(c.RepoRoot, f.Pkg)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var srcs []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if tsExtRe.MatchString(name) {
			srcs = append(srcs, name)
		}
	}
	sort.Strings(srcs)
	return srcs
}

func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	if r.Kind() != "ts_project" {
		return nil
	}
	if !inAllowlist(f.Pkg) {
		return nil
	}

	srcs := ruleSrcs(c, f, r)
	if len(srcs) == 0 {
		return nil
	}

	var specs []resolve.ImportSpec
	for _, s := range srcs {
		specs = append(specs, resolve.ImportSpec{Lang: "typescript", Imp: importAlias(f.Pkg, s)})
	}
	return specs
}

func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }

// Resolve sets deps on ts_project rules for node_modules packages referenced in sources.
func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	if r.Kind() != "ts_project" {
		return
	}

	if !inAllowlist(from.Pkg) {
		return
	}

	pkgjson, _ := c.Exts["javascript"].(gazellejs.PackageJsonPartial)
	depSet := map[string]bool{}
	if attr := r.Attr("deps"); attr != nil {
		if list, ok := attr.(*build.ListExpr); ok {
			for _, d := range list.List {
				if s, ok := d.(*build.StringExpr); ok {
					depSet[s.Value] = true
				}
			}
		}
	}

	for _, src := range ruleSrcs(c, &rule.File{Pkg: from.Pkg}, r) {
		filePath := path.Join(c.RepoRoot, from.Pkg, src)
		imps, err := listImports(filePath)
		if err != nil {
			continue
		}
		for _, imp := range imps {
			if strings.HasPrefix(imp, ".") {
				continue
			}
			if strings.HasPrefix(imp, "#") {
				matches := ix.FindRulesByImportWithConfig(c, resolve.ImportSpec{Lang: "typescript", Imp: imp}, "typescript")
				if len(matches) > 0 {
					depSet[matches[0].Label.String()] = true
				}
				continue
			}
			if strings.HasPrefix(imp, "node:") {
				depSet["//:node_modules/@types/node"] = true
				continue
			}
			mod := nodeModulesModuleFromImportString(imp)
			if mod == "" {
				continue
			}
			if pkgjson.HasDep(mod) {
				depSet[fmt.Sprintf("//:node_modules/%s", mod)] = true
			}
		}
	}

	if len(depSet) == 0 {
		return
	}
	var deps []string
	for d := range depSet {
		deps = append(deps, d)
	}
	sort.Strings(deps)
	r.SetAttr("deps", deps)
}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_project": {
			MatchAny:       true,
			MergeableAttrs: map[string]bool{"srcs": true, "deps": true},
			ResolveAttrs:   map[string]bool{"deps": true},
		},
	}
}

func (Language) GenerateRules(language.GenerateArgs) language.GenerateResult {
	return language.GenerateResult{}
}

func (Language) Loads() []rule.LoadInfo                            { return nil }
func (Language) ApparentLoads(func(string) string) []rule.LoadInfo { return nil }

func (Language) Fix(c *config.Config, f *rule.File) {
	pkgjson, _ := c.Exts["javascript"].(gazellejs.PackageJsonPartial)

	if !inAllowlist(f.Pkg) {
		return
	}

	for _, r := range f.Rules {
		if r.Kind() != "ts_project" {
			continue
		}

		depSet := map[string]bool{}
		if attr := r.Attr("deps"); attr != nil {
			if list, ok := attr.(*build.ListExpr); ok {
				for _, d := range list.List {
					if s, ok := d.(*build.StringExpr); ok {
						depSet[s.Value] = true
					}
				}
			}
		}
		for _, src := range ruleSrcs(c, f, r) {
			filePath := path.Join(c.RepoRoot, f.Pkg, src)
			imps, err := listImports(filePath)
			if err != nil {
				continue
			}
			for _, imp := range imps {
				if strings.HasPrefix(imp, ".") || strings.HasPrefix(imp, "#") {
					continue
				}
				if strings.HasPrefix(imp, "node:") {
					depSet["//:node_modules/@types/node"] = true
					continue
				}

				mod := nodeModulesModuleFromImportString(imp)
				if mod == "" {
					continue
				}
				if pkgjson.HasDep(mod) {
					depSet[fmt.Sprintf("//:node_modules/%s", mod)] = true
				}
			}
		}

		if len(depSet) == 0 {
			continue
		}
		deps := make([]string, 0, len(depSet))
		for d := range depSet {
			deps = append(deps, d)
		}
		sort.Strings(deps)
		r.SetAttr("deps", deps)
	}
}

func NewLanguage() language.Language { return &Language{} }
