package md

import (
	"flag"
	"net/url"
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
)

type Language struct{}

var (
	inlineLinkRE    = regexp.MustCompile(`!?\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+[^)]*)?\)`)
	referenceLinkRE = regexp.MustCompile(`(?m)^\[[^\]]+\]:[ \t]*(?:<([^>\n]+)>|([^ \t\n]+))`)
)

func (Language) Name() string { return "markdown" }

func (Language) RegisterFlags(fs *flag.FlagSet, cmd string, c *config.Config) {}
func (Language) CheckFlags(fs *flag.FlagSet, c *config.Config) error          { return nil }
func (Language) KnownDirectives() []string                                    { return nil }
func (Language) Configure(c *config.Config, rel string, f *rule.File)         {}
func (Language) Embeds(r *rule.Rule, from label.Label) []label.Label          { return nil }
func (Language) Imports(c *config.Config, r *rule.Rule, f *rule.File) []resolve.ImportSpec {
	return nil
}
func (Language) Resolve(c *config.Config, ix *resolve.RuleIndex, rc *repo.RemoteCache, r *rule.Rule, imports interface{}, from label.Label) {
}
func (Language) Fix(c *config.Config, f *rule.File) {}

func (Language) Kinds() map[string]rule.KindInfo {
	return map[string]rule.KindInfo{
		"md_files": {
			MatchAny: true,
			NonEmptyAttrs: map[string]bool{
				"srcs": true,
			},
			MergeableAttrs: map[string]bool{
				"srcs":       true,
				"refs":       true,
				"visibility": true,
			},
		},
	}
}

func (Language) ApparentLoads(moduleToApparentName func(string) string) []rule.LoadInfo {
	return []rule.LoadInfo{
		{Name: "//md:rules.bzl", Symbols: []string{"md_files"}},
	}
}

func (Language) Loads() []rule.LoadInfo {
	panic("Call ApparentLoads")
}

var _ language.ModuleAwareLanguage = Language{}

func isMarkdownFile(name string) bool {
	return strings.HasSuffix(name, ".md")
}

func markdownRefs(content string) []string {
	var refs []string
	for _, match := range inlineLinkRE.FindAllStringSubmatch(content, -1) {
		refs = append(refs, firstNonEmpty(match[1:]...))
	}
	for _, match := range referenceLinkRE.FindAllStringSubmatch(content, -1) {
		refs = append(refs, firstNonEmpty(match[1:]...))
	}
	return refs
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func normalizeMarkdownRef(ref string) (string, bool) {
	ref = strings.TrimSpace(ref)
	ref = strings.Trim(ref, "<>")
	if ref == "" || strings.HasPrefix(ref, "#") || strings.HasPrefix(ref, "//") {
		return "", false
	}

	if u, err := url.Parse(ref); err == nil {
		if u.Scheme != "" {
			return "", false
		}
		ref = u.Path
	}

	ref = strings.TrimSpace(ref)
	if ref == "" || ref == "." {
		return "", false
	}

	if unescaped, err := url.PathUnescape(ref); err == nil {
		ref = unescaped
	}

	return ref, true
}

func repoPathForRef(pkgRel, ref string) (string, bool) {
	ref, ok := normalizeMarkdownRef(ref)
	if !ok {
		return "", false
	}

	var repoPath string
	if strings.HasPrefix(ref, "/") {
		repoPath = strings.TrimPrefix(ref, "/")
	} else {
		repoPath = path.Join(pkgRel, ref)
	}

	repoPath = path.Clean(repoPath)
	if repoPath == "." || repoPath == "" || strings.HasPrefix(repoPath, "../") || repoPath == ".." {
		return "", false
	}

	return repoPath, true
}

func labelForRepoPath(pkgRel, repoPath string) string {
	if pkgRel == "" {
		if !strings.Contains(repoPath, "/") {
			return repoPath
		}
	} else if repoPath == pkgRel || strings.HasPrefix(repoPath, pkgRel+"/") {
		return strings.TrimPrefix(repoPath, pkgRel+"/")
	}

	dir, base := path.Split(repoPath)
	dir = strings.TrimSuffix(dir, "/")
	if dir == "" {
		return "//:" + base
	}
	return "//" + dir + ":" + base
}

func isExistingDirectory(root, repoPath string) bool {
	info, err := os.Stat(filepath.Join(root, filepath.FromSlash(repoPath)))
	return err == nil && info.IsDir()
}

func (Language) GenerateRules(args language.GenerateArgs) language.GenerateResult {
	var srcs []string
	refSet := make(map[string]struct{})

	for _, fileName := range args.RegularFiles {
		if !isMarkdownFile(fileName) {
			continue
		}

		srcs = append(srcs, fileName)
		content, err := os.ReadFile(filepath.Join(args.Dir, fileName))
		if err != nil {
			panic(err)
		}

		for _, ref := range markdownRefs(string(content)) {
			repoPath, ok := repoPathForRef(args.Rel, ref)
			if !ok || repoPath == path.Join(args.Rel, fileName) || isExistingDirectory(args.Config.RepoRoot, repoPath) {
				continue
			}
			refSet[labelForRepoPath(args.Rel, repoPath)] = struct{}{}
		}
	}

	if len(srcs) == 0 {
		return language.GenerateResult{}
	}

	sort.Strings(srcs)
	refs := make([]string, 0, len(refSet))
	for ref := range refSet {
		refs = append(refs, ref)
	}
	sort.Strings(refs)

	r := rule.NewRule("md_files", "md")
	r.SetAttr("srcs", srcs)
	if len(refs) > 0 {
		r.SetAttr("refs", refs)
	}
	r.SetAttr("visibility", []string{"//:__subpackages__"})

	return language.GenerateResult{
		Gen:     []*rule.Rule{r},
		Imports: []interface{}{nil},
	}
}

func NewLanguage() language.Language { return &Language{} }
