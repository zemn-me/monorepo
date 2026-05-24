package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTestFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o777); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o666); err != nil {
		t.Fatal(err)
	}
}

func sha256Hex(content string) string {
	digest := sha256.Sum256([]byte(content))
	return hex.EncodeToString(digest[:])
}

func TestGenerateWritesModuleAndDigestFiles(t *testing.T) {
	dir := t.TempDir()
	publicDir := filepath.Join(dir, "public", "sha256")
	module := filepath.Join(dir, "sources.ts")
	mp4 := filepath.Join(dir, "assets", "video.mp4")
	jpg := filepath.Join(dir, "assets", "poster.jpg")

	writeTestFile(t, mp4, "video")
	writeTestFile(t, jpg, "poster")

	if err := runGenerate([]string{
		publicDir,
		"/sha256/",
		module,
		"2",
		mp4,
		"mp4",
		jpg,
		"jpg",
	}); err != nil {
		t.Fatal(err)
	}

	moduleContentBytes, err := os.ReadFile(module)
	if err != nil {
		t.Fatal(err)
	}
	moduleContent := string(moduleContentBytes)

	for _, tc := range []struct {
		exportName string
		content    string
	}{
		{exportName: "mp4", content: "video"},
		{exportName: "jpg", content: "poster"},
	} {
		digest := sha256Hex(tc.content)
		if _, err := os.Stat(filepath.Join(publicDir, digest)); err != nil {
			t.Fatalf("expected digest file for %s: %v", tc.exportName, err)
		}
		want := `export const ` + tc.exportName + ` = "/sha256/` + digest + `";`
		if !strings.Contains(moduleContent, want) {
			t.Fatalf("generated module missing %q in:\n%s", want, moduleContent)
		}
	}
}

func TestCollectCopiesRegularFilesByBasename(t *testing.T) {
	dir := t.TempDir()
	srcDir := filepath.Join(dir, "src")
	outDir := filepath.Join(dir, "out")
	src := filepath.Join(srcDir, "abc123")

	writeTestFile(t, src, "asset")
	if err := os.Mkdir(filepath.Join(srcDir, "nested"), 0o777); err != nil {
		t.Fatal(err)
	}

	if err := runCollect([]string{outDir, src, filepath.Join(srcDir, "nested")}); err != nil {
		t.Fatal(err)
	}

	got, err := os.ReadFile(filepath.Join(outDir, "abc123"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "asset" {
		t.Fatalf("collected file content = %q, want asset", got)
	}
}
