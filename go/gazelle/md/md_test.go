package md

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/language"
)

func TestMarkdownRefs(t *testing.T) {
	got := markdownRefs(`
[local](./asset.png)
![image](../img/photo.jpg?raw=1#frag)
[angle](<./path with spaces.md>)
[external](https://example.com/nope)
[reference-style][guide]
[collapsed-reference][]
[ref]: docs/guide.md
[guide]: <docs/reference guide.md>
[collapsed-reference]: ./collapsed.md "title"
`)
	want := []string{
		"./asset.png",
		"../img/photo.jpg?raw=1#frag",
		"./path with spaces.md",
		"https://example.com/nope",
		"docs/guide.md",
		"docs/reference guide.md",
		"./collapsed.md",
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("markdownRefs() = %#v, want %#v", got, want)
	}
}

func TestRepoPathForRef(t *testing.T) {
	for _, tc := range []struct {
		name   string
		pkgRel string
		ref    string
		want   string
		wantOK bool
	}{
		{
			name:   "relative",
			pkgRel: "docs/post",
			ref:    "./image.png?raw=1#frag",
			want:   "docs/post/image.png",
			wantOK: true,
		},
		{
			name:   "absolute",
			pkgRel: "docs/post",
			ref:    "/README.md",
			want:   "README.md",
			wantOK: true,
		},
		{
			name:   "external",
			pkgRel: "docs/post",
			ref:    "https://example.com/README.md",
		},
		{
			name:   "fragment",
			pkgRel: "docs/post",
			ref:    "#heading",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, gotOK := repoPathForRef(tc.pkgRel, tc.ref)
			if gotOK != tc.wantOK || got != tc.want {
				t.Fatalf("repoPathForRef(%q, %q) = %q, %t; want %q, %t", tc.pkgRel, tc.ref, got, gotOK, tc.want, tc.wantOK)
			}
		})
	}
}

func TestLabelForRepoPath(t *testing.T) {
	for _, tc := range []struct {
		name     string
		pkgRel   string
		repoPath string
		want     string
	}{
		{
			name:     "same package",
			pkgRel:   "docs/post",
			repoPath: "docs/post/image.png",
			want:     "image.png",
		},
		{
			name:     "other package",
			pkgRel:   "docs/post",
			repoPath: "docs/assets/image.png",
			want:     "//docs/assets:image.png",
		},
		{
			name:     "root file from nested package",
			pkgRel:   "docs/post",
			repoPath: "README.md",
			want:     "//:README.md",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := labelForRepoPath(tc.pkgRel, tc.repoPath); got != tc.want {
				t.Fatalf("labelForRepoPath(%q, %q) = %q, want %q", tc.pkgRel, tc.repoPath, got, tc.want)
			}
		})
	}
}

func TestGenerateRulesAddsMarkdownReferenceLabels(t *testing.T) {
	root := t.TempDir()
	docs := filepath.Join(root, "docs")
	if err := os.MkdirAll(docs, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(docs, "README.md"), []byte(`
[inline](./inline.md)
![image](/assets/image.png)
[angle](<./angle ref.md>)
[reference][ref]

[ref]: ../shared/reference.md
`), 0o644); err != nil {
		t.Fatal(err)
	}

	var lang Language
	result := lang.GenerateRules(language.GenerateArgs{
		Config: &config.Config{
			RepoRoot: root,
		},
		Dir:          docs,
		Rel:          "docs",
		RegularFiles: []string{"README.md"},
	})

	if len(result.Gen) != 1 {
		t.Fatalf("GenerateRules produced %d rules, want 1", len(result.Gen))
	}

	got := result.Gen[0].AttrStrings("refs")
	want := []string{
		"//assets:image.png",
		"//shared:reference.md",
		"angle ref.md",
		"inline.md",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("refs = %#v, want %#v", got, want)
	}
}
