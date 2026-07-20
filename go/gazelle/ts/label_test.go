package ts

import (
	"testing"

	"github.com/bazelbuild/bazel-gazelle/label"
)

func TestFormatLabelNormalizesMainRepoName(t *testing.T) {
	from := label.New("", "project/me/zemn/app", "app")
	target := label.New("monorepo", "jpeg/2026/05/25", "profile_photo")

	if got := formatLabel(target, from, "monorepo"); got != "//jpeg/2026/05/25:profile_photo" {
		t.Fatalf("formatLabel() = %q, want //jpeg/2026/05/25:profile_photo", got)
	}
}

func TestFormatLabelPreservesExternalRepoName(t *testing.T) {
	from := label.New("", "project/me/zemn/app", "app")
	target := label.New("other_repo", "jpeg/2026/05/25", "profile_photo")

	if got := formatLabel(target, from, "monorepo"); got != "@other_repo//jpeg/2026/05/25:profile_photo" {
		t.Fatalf("formatLabel() = %q, want @other_repo//jpeg/2026/05/25:profile_photo", got)
	}
}
