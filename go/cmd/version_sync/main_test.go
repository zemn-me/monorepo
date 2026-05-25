package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDoFixUsesGoModGoDirectiveAsSource(t *testing.T) {
	dir := t.TempDir()
	goMod := filepath.Join(dir, "go.mod")
	moduleBazel := filepath.Join(dir, "MODULE.bazel")

	writeTestFile(t, goMod, "module example.com/test\n\ngo 1.24.3\n")
	writeTestFile(t, moduleBazel, "GO_VERSION = \"1.24.4\"\n")
	withVersionSyncGlobals(t, goMod, moduleBazel, true)

	if err := Do(); err != nil {
		t.Fatalf("Do: %v", err)
	}

	assertFileContains(t, goMod, "go 1.24.3\n")
	assertFileContains(t, moduleBazel, "GO_VERSION = \"1.24.3\"\n")
}

func TestDoFixSyncsToolchainToGoModGoDirective(t *testing.T) {
	dir := t.TempDir()
	goMod := filepath.Join(dir, "go.mod")
	moduleBazel := filepath.Join(dir, "MODULE.bazel")

	writeTestFile(t, goMod, "module example.com/test\n\ngo 1.24.3\ntoolchain go1.24.4\n")
	writeTestFile(t, moduleBazel, "GO_VERSION = \"1.24.2\"\n")
	withVersionSyncGlobals(t, goMod, moduleBazel, true)

	if err := Do(); err != nil {
		t.Fatalf("Do: %v", err)
	}

	assertFileContains(t, goMod, "go 1.24.3\ntoolchain go1.24.3\n")
	assertFileContains(t, moduleBazel, "GO_VERSION = \"1.24.3\"\n")
}

func TestDoCheckReportsGoModGoDirectiveAsSource(t *testing.T) {
	dir := t.TempDir()
	goMod := filepath.Join(dir, "go.mod")
	moduleBazel := filepath.Join(dir, "MODULE.bazel")

	writeTestFile(t, goMod, "module example.com/test\n\ngo 1.24.3\n")
	writeTestFile(t, moduleBazel, "GO_VERSION = \"1.24.4\"\n")
	withVersionSyncGlobals(t, goMod, moduleBazel, false)

	err := Do()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "go.mod go directive 1.24.3") {
		t.Fatalf("expected go.mod source version in error, got %q", err.Error())
	}
}

func withVersionSyncGlobals(t *testing.T, goMod, moduleBazel string, fix bool) {
	t.Helper()

	oldGoModPath := goModPath
	oldBazelPath := bazelPath
	oldFixDiscrepancy := fixDiscrepancy
	oldOutputGoMod := outputGoMod
	oldOutputBazel := outputBazel

	goModPath = goMod
	bazelPath = moduleBazel
	fixDiscrepancy = fix
	outputGoMod = ""
	outputBazel = ""

	t.Cleanup(func() {
		goModPath = oldGoModPath
		bazelPath = oldBazelPath
		fixDiscrepancy = oldFixDiscrepancy
		outputGoMod = oldOutputGoMod
		outputBazel = oldOutputBazel
	})
}

func writeTestFile(t *testing.T, path, contents string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func assertFileContains(t *testing.T, path, want string) {
	t.Helper()

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if !strings.Contains(string(got), want) {
		t.Fatalf("%s does not contain %q; got:\n%s", path, want, got)
	}
}
