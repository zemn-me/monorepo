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
	bzl "github.com/bazelbuild/buildtools/build"

	tsconfig "github.com/zemn-me/monorepo/go/gazelle/ts/config"
)

const (
	packageJSONExtKey  = "typescript.package_json"
	rootTsConfigExtKey = "typescript.root_tsconfig"
)

type passthroughExpr struct {
	expr bzl.Expr
}

func (p passthroughExpr) BzlExpr() bzl.Expr { return p.expr }

func (p passthroughExpr) Merge(other bzl.Expr) bzl.Expr {
	if other != nil {
		return other
	}
	return p.expr
}

var (
	importPattern         = regexp.MustCompile(`(?m)(?:^|\s)(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)`)
	jsdomDirectivePattern = regexp.MustCompile(`(?m)@jest-environment\s+jsdom`)
	knownFileExtensions   = []string{".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".json"}
	defaultDeps           = []string{"//:node_modules/@types/node"}
	builtinModulePrefix   = "node:"
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
		resolved = path.Clean(resolved)
		if strings.HasPrefix(resolved, "dist/bin/") {
			continue
		}

		return resolved, true
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

	preferDir := false
	switch {
	case strings.HasSuffix(cleaned, "/index"), strings.HasSuffix(cleaned, "/index.d.ts"):
		preferDir = true
	default:
		for _, ext := range knownFileExtensions {
			if strings.HasSuffix(cleaned, "/index"+ext) {
				preferDir = true
				break
			}
		}
	}

	cleaned = trimKnownExtensions(cleaned)

	if info, err := os.Stat(filepath.Join(repoRoot, cleaned)); err == nil && info.IsDir() {
		// use directory as-is
	} else if preferDir {
		// keep the directory even if it is missing from the test runfiles tree
	} else if pathExistsWithExt(repoRoot, cleaned) {
		if idx := strings.LastIndex(cleaned, "/"); idx != -1 {
			cleaned = cleaned[:idx]
		} else {
			cleaned = ""
		}
	} else if idx := strings.LastIndex(cleaned, "/"); idx != -1 {
		parent := cleaned[:idx]
		if parent != "" {
			if info, err := os.Stat(filepath.Join(repoRoot, parent)); err == nil && info.IsDir() {
				cleaned = parent
			}
		} else {
			cleaned = parent
		}
	}

	cleaned = strings.Trim(cleaned, "/")
	if cleaned == "" || cleaned == from.Pkg {
		return "", false
	}

	return "//" + cleaned, true
}

func nodeModulesModuleFromImportString(importString string) string {
	importString = strings.TrimSpace(importString)
	if importString == "" {
		return ""
	}
	if strings.HasPrefix(importString, "@") {
		parts := strings.Split(importString, "/")
		if len(parts) >= 2 {
			return parts[0] + "/" + parts[1]
		}
		return importString
	}

	if idx := strings.Index(importString, "/"); idx != -1 {
		return importString[:idx]
	}

	return importString
}

func extractImports(filePath string) ([]string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	content := strings.ReplaceAll(string(data), "\n", " ")
	matches := importPattern.FindAllStringSubmatch(content, -1)
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

func ExtractImportsForTest(filePath string) ([]string, error) {
	return extractImports(filePath)
}

func hasJsdomDirective(filePath string) (bool, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return false, err
	}
	return jsdomDirectivePattern.Match(data), nil
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

func isSuppressedFile(rel, file string) bool {
	repoPath := path.Join(rel, file)
	repoPath = strings.TrimPrefix(repoPath, "./")
	repoPath = strings.TrimPrefix(repoPath, "/")
	repoPath = path.Clean(repoPath)
	if repoPath == "" || repoPath == "." {
		return false
	}
	_, ok := SuppressGazelleTypescriptFor[repoPath]
	return ok
}

func findExistingRule(args language.GenerateArgs, name string) *rule.Rule {
	if args.File == nil {
		return nil
	}

	for _, existing := range args.File.Rules {
		if existing.Kind() != "ts_project" {
			continue
		}
		if existing.Name() == name {
			return existing
		}
	}

	return nil
}

func listExprStringValues(expr bzl.Expr) ([]string, bool) {
	list, ok := expr.(*bzl.ListExpr)
	if !ok {
		return nil, false
	}

	values := make([]string, 0, len(list.List))
	for _, elem := range list.List {
		str, ok := elem.(*bzl.StringExpr)
		if !ok {
			return nil, false
		}
		values = append(values, str.Value)
	}

	return values, true
}

func shouldPreserveSrcs(expr bzl.Expr) ([]string, bool) {
	values, ok := listExprStringValues(expr)
	if !ok {
		return nil, false
	}

	for _, v := range values {
		if strings.HasPrefix(v, ":") || strings.HasPrefix(v, "//") {
			return values, true
		}
	}

	return nil, false
}

func countTsProjects(f *rule.File) int {
	if f == nil {
		return 0
	}
	count := 0
	for _, r := range f.Rules {
		if r.Kind() == "ts_project" {
			count++
		}
	}
	return count
}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"ts_project": {
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
		"jest_test": {
			MergeableAttrs: map[string]bool{
				"srcs": true,
				"deps": true,
			},
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
		},
	}
}

func (Language) Loads() []rule.LoadInfo {
	return []rule.LoadInfo{
		{Name: "//bzl:rules.bzl", Symbols: []string{"bazel_lint"}},
		{Name: "//ts:rules.bzl", Symbols: []string{"jest_test", "ts_project"}},
	}
}

func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	return nil
}

func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
	if imports == nil {
		return
	}
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
		if !strings.HasPrefix(moduleName, "@") {
			typePkg := "@types/" + moduleName
			if pkgJSON.HasDep(typePkg) {
				deps[fmt.Sprintf("//:node_modules/%s", typePkg)] = struct{}{}
			}
		}
	}

	if len(deps) == 0 {
		return
	}

	if mainDep, ok := r.PrivateAttr(testMainDepKey).(string); ok && mainDep != "" {
		deps[mainDep] = struct{}{}
	}

	labels := make([]string, 0, len(deps))
	for dep := range deps {
		labels = append(labels, dep)
	}
	sort.Strings(labels)
	r.SetAttr("deps", labels)
}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	if strings.HasPrefix(args.Rel, "ts/") && countTsProjects(args.File) > 2 {
		return language.GenerateResult{}
	}

	var (
		srcs     []string
		testSrcs []string
		mainDeps = newDepSet()
		testDeps = newDepSet()
	)

	needsJsdom := false
	for _, f := range args.RegularFiles {
		if !isTypeScriptFile(f) {
			continue
		}
		if isSuppressedFile(args.Rel, f) {
			continue
		}

		isTest := strings.HasSuffix(f, "_test.ts") || strings.HasSuffix(f, "_test.tsx")
		if isTest {
			testSrcs = append(testSrcs, f)
		} else {
			srcs = append(srcs, f)
		}

		absPath := filepath.Join(args.Dir, f)

		if isTest {
			jsdom, err := hasJsdomDirective(absPath)
			if err != nil {
				panic(fmt.Sprintf("read jsdom directive from %s: %v", absPath, err))
			}
			if jsdom {
				needsJsdom = true
			}
		}

		imports, err := extractImports(absPath)
		if err != nil {
			panic(fmt.Sprintf("extract imports from %s: %v", absPath, err))
		}

		target := mainDeps
		if isTest {
			target = testDeps
		}

		for _, imp := range imports {
			target.add(imp)
		}
	}

	if len(srcs) == 0 {
		if len(testSrcs) == 0 {
			return language.GenerateResult{}
		}

		srcs = append(srcs, testSrcs...)
		mainDeps = testDeps
		testSrcs = nil
		testDeps = newDepSet()
	}

	sort.Strings(srcs)
	sort.Strings(testSrcs)

	name := filepath.Base(args.Dir)
	r := rule.NewRule("ts_project", name)
	r.SetAttr("visibility", []string{"//:__subpackages__"})
	if existing := findExistingRule(args, name); existing != nil {
		if attr := existing.Attr("srcs"); attr != nil {
			if preserved, ok := shouldPreserveSrcs(attr); ok {
				r.SetAttr("srcs", preserved)
			} else if call, ok := attr.(*bzl.CallExpr); ok {
				if lit, ok := call.X.(*bzl.LiteralExpr); ok && lit.Token == "glob" {
					// preserve existing glob
				} else {
					r.SetAttr("srcs", srcs)
				}
			} else {
				r.SetAttr("srcs", srcs)
			}
		} else {
			r.SetAttr("srcs", srcs)
		}
	} else {
		r.SetAttr("srcs", srcs)
	}

	gen := []*rule.Rule{r}
	imports := []interface{}{mainDeps}

	allSrcs := append(append([]string{}, srcs...), testSrcs...)
	fg := rule.NewRule("filegroup", "all_ts_srcs")
	fg.SetAttr("srcs", allSrcs)
	fg.SetAttr("visibility", []string{"//:__subpackages__"})
	gen = append(gen, fg)
	imports = append(imports, nil)

	var testProjectName string
	if len(testSrcs) > 0 {
		testProjectName = name + "_tests"
		testRule := rule.NewRule("ts_project", testProjectName)
		testRule.SetAttr("srcs", testSrcs)
		testRule.SetAttr("deps", []string{":" + name})
		testRule.SetAttr("visibility", []string{"//:__subpackages__"})
		testRule.SetPrivateAttr(testMainDepKey, ":"+name)
		gen = append(gen, testRule)
		imports = append(imports, testDeps)
	}

	testCfg := testRuleConfig{
		mainName:   name,
		srcs:       testSrcs,
		deps:       testDeps,
		needsJsdom: needsJsdom,
	}
	testCfg.buildRules(args, &gen, &imports)

	lint := rule.NewRule("bazel_lint", "bazel_lint")
	lint.SetAttr("srcs", []string{"BUILD.bazel"})
	lint.SetAttr("visibility", []string{"//:__subpackages__"})
	gen = append(gen, lint)
	imports = append(imports, nil)

	return language.GenerateResult{
		Gen:     gen,
		Imports: imports,
	}
}

func NewLanguage() language.Language { return &Language{} }
