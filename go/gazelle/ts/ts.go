package ts

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
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
	allowPath = "go/gazelle/ts"

	packageJSONExtKey  = "typescript.package_json"
	rootTsConfigExtKey = "typescript.root_tsconfig"
)

var (
	importPattern       = regexp.MustCompile(`(?m)(?:^|\s)(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)`)
	nodeModulePattern   = regexp.MustCompile(`@[^/]+/[^/]+|[^/]+`)
	knownFileExtensions = []string{".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".json"}
	defaultDeps         = []string{"//:node_modules/@types/node"}
	builtinModulePrefix = "node:"
)

type depSet map[string]struct{}

func newDepSet() depSet { return make(depSet) }

func (d depSet) add(value string) {
	if d == nil || value == "" {
		return
	}
	d[value] = struct{}{}
}

type packageJSONPartial struct {
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
}

func (p packageJSONPartial) HasDep(name string) bool {
	if p.Dependencies != nil {
		if _, ok := p.Dependencies[name]; ok {
			return true
		}
	}
	if p.DevDependencies != nil {
		if _, ok := p.DevDependencies[name]; ok {
			return true
		}
	}
	return false
}

func loadPackageJSON(filePath string) (packageJSONPartial, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return packageJSONPartial{}, err
	}

	var pkg packageJSONPartial
	if err := json.Unmarshal(data, &pkg); err != nil {
		return packageJSONPartial{}, err
	}

	return pkg, nil
}

func ensurePackageJSON(c *config.Config) packageJSONPartial {
	if existing, ok := c.Exts[packageJSONExtKey].(packageJSONPartial); ok {
		return existing
	}

	pkg, err := loadPackageJSON(filepath.Join(c.RepoRoot, "package.json"))
	if err != nil {
		panic(fmt.Sprintf("load package.json: %v", err))
	}

	c.Exts[packageJSONExtKey] = pkg
	return pkg
}

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

type pathPattern struct {
	prefix       string
	suffix       string
	replacements []string
}

func compilePathPatterns(m map[string][]string) []pathPattern {
	patterns := make([]pathPattern, 0, len(m))
	for pattern, replacements := range m {
		first := strings.Index(pattern, "*")
		last := strings.LastIndex(pattern, "*")

		var prefix, suffix string
		switch {
		case first == -1:
			prefix = pattern
			suffix = ""
		default:
			prefix = pattern[:first]
			suffix = pattern[last+1:]
		}

		patterns = append(patterns, pathPattern{
			prefix:       prefix,
			suffix:       suffix,
			replacements: replacements,
		})
	}

	return patterns
}

func (p pathPattern) resolve(module string) (string, bool) {
	if !strings.HasPrefix(module, p.prefix) {
		return "", false
	}
	if !strings.HasSuffix(module, p.suffix) {
		return "", false
	}

	middle := module[len(p.prefix) : len(module)-len(p.suffix)]
	for _, repl := range p.replacements {
		resolved := strings.ReplaceAll(repl, "*", middle)
		return resolved, true
	}

	return "", false
}

func resolveModuleToRepoPath(module string, conf tsconfig.TsConfigPartial) (string, bool) {
	mappings := conf.PathMappings()
	if len(mappings) == 0 {
		return "", false
	}

	for _, pattern := range compilePathPatterns(mappings) {
		resolved, ok := pattern.resolve(module)
		if !ok {
			continue
		}

		if base := conf.CompilerOptions.BaseURL; base != "" && base != "." {
			resolved = path.Join(base, resolved)
		}

		resolved = strings.TrimPrefix(resolved, "./")
		return path.Clean(resolved), true
	}

	return "", false
}

func trimKnownExtensions(p string) string {
	if strings.HasSuffix(p, ".d.ts") {
		p = strings.TrimSuffix(p, ".d.ts")
	}

	if ext := path.Ext(p); ext != "" {
		p = strings.TrimSuffix(p, ext)
	}

	p = strings.TrimSuffix(p, "/")
	p = strings.TrimSuffix(p, "/index")

	return p
}

func pathExistsWithExt(repoRoot, base string) bool {
	for _, ext := range knownFileExtensions {
		info, err := os.Stat(filepath.Join(repoRoot, base+ext))
		if err != nil {
			continue
		}

		if !info.IsDir() {
			return true
		}
	}

	return false
}

func repoPathToLabel(repoRoot, repoPath string, from label.Label) (string, bool) {
	cleaned := strings.TrimSpace(repoPath)
	cleaned = strings.TrimPrefix(cleaned, "./")
	cleaned = strings.TrimPrefix(cleaned, "/")
	cleaned = path.Clean(cleaned)
	if cleaned == "." || cleaned == "" {
		return "", false
	}

	if strings.HasPrefix(cleaned, "dist/bin/") {
		return "", false
	}

	cleaned = trimKnownExtensions(cleaned)

	if pathExistsWithExt(repoRoot, cleaned) {
		if idx := strings.LastIndex(cleaned, "/"); idx != -1 {
			cleaned = cleaned[:idx]
		} else {
			cleaned = ""
		}
	}

	cleaned = strings.Trim(cleaned, "/")
	if cleaned == "" || cleaned == from.Pkg {
		return "", false
	}

	return "//" + cleaned, true
}

func nodeModulesModuleFromImportString(importString string) string {
	return nodeModulePattern.FindString(importString)
}

func extractImports(filePath string) ([]string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	matches := importPattern.FindAllSubmatch(data, -1)
	imports := make([]string, 0, len(matches))
	for _, match := range matches {
		for i := 1; i < len(match); i++ {
			if len(match[i]) == 0 {
				continue
			}
			imports = append(imports, string(match[i]))
			break
		}
	}

	return imports, nil
}

func isTypeScriptFile(name string) bool {
	return strings.HasSuffix(name, ".ts") || strings.HasSuffix(name, ".tsx")
}

// Language implements a very small Gazelle extension that
// generates ts_project rules for TypeScript files.
type Language struct{}

func (Language) Name() string { return "typescript" }

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return []string{} }

func (Language) Configure(c *config.Config, rel string, f *rule.File) {
	if rel == "" {
		ensurePackageJSON(c)
		ensureRootTsConfig(c)
	}
}

func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label { return nil }
func (Language) Fix(c *config.Config, f *rule.File)                  {}

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
	modules := imports.(depSet)

	if len(modules) == 0 {
		if len(defaultDeps) == 0 {
			return
		}

		r.SetAttr("deps", append([]string{}, defaultDeps...))
		return
	}

	deps := make(map[string]struct{})
	for _, d := range defaultDeps {
		deps[d] = struct{}{}
	}

	pkgJSON := ensurePackageJSON(c)
	rootConfig := ensureRootTsConfig(c)

	for module := range modules {
		if module == "" {
			continue
		}
		if strings.HasPrefix(module, ".") || strings.HasPrefix(module, "/") {
			continue
		}
		if strings.HasPrefix(module, builtinModulePrefix) {
			continue
		}

		if strings.HasPrefix(module, "#") {
			if resolved, ok := resolveModuleToRepoPath(module, rootConfig); ok {
				if label, ok := repoPathToLabel(c.RepoRoot, resolved, from); ok {
					deps[label] = struct{}{}
				}
				continue
			}
		}

		moduleName := nodeModulesModuleFromImportString(module)
		if moduleName == "" {
			continue
		}
		if !pkgJSON.HasDep(moduleName) {
			continue
		}

		deps[fmt.Sprintf("//:node_modules/%s", moduleName)] = struct{}{}
	}

	if len(deps) == 0 {
		return
	}

	labels := make([]string, 0, len(deps))
	for dep := range deps {
		labels = append(labels, dep)
	}
	sort.Strings(labels)
	r.SetAttr("deps", labels)
}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	if !isAllowed(args.Rel) {
		return language.GenerateResult{}
	}

	var (
		srcs []string
		deps = newDepSet()
	)

	for _, f := range args.RegularFiles {
		if !isTypeScriptFile(f) {
			continue
		}

		srcs = append(srcs, f)

		imports, err := extractImports(filepath.Join(args.Dir, f))
		if err != nil {
			panic(fmt.Sprintf("extract imports from %s: %v", filepath.Join(args.Dir, f), err))
		}

		for _, imp := range imports {
			deps.add(imp)
		}
	}

	if len(srcs) == 0 {
		return language.GenerateResult{}
	}

	sort.Strings(srcs)

	name := filepath.Base(args.Dir)
	r := rule.NewRule("ts_project", name)
	r.SetAttr("srcs", srcs)

	return language.GenerateResult{
		Gen:     []*rule.Rule{r},
		Imports: []interface{}{deps},
	}
}

func NewLanguage() language.Language { return &Language{} }
