package main

import (
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
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

func writeJPEGTestFile(t *testing.T, path string, c color.Color) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o777); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, c)
	if err := jpeg.Encode(file, img, nil); err != nil {
		t.Fatal(err)
	}
}

func writePNGTestFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o777); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	img := image.NewRGBA(image.Rect(0, 0, 2, 1))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	img.Set(1, 0, color.RGBA{B: 255, A: 255})
	if err := png.Encode(file, img); err != nil {
		t.Fatal(err)
	}
}

func TestAverageColorHex(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2, 1))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	img.Set(1, 0, color.RGBA{B: 255, A: 255})

	got, err := averageColorHex(img)
	if err != nil {
		t.Fatal(err)
	}
	if got != "#800080" {
		t.Fatalf("averageColorHex() = %q, want #800080", got)
	}
}

func TestGenerateWritesModuleAndDigestFiles(t *testing.T) {
	dir := t.TempDir()
	publicDir := filepath.Join(dir, "public", "sha256")
	module := filepath.Join(dir, "sources.ts")
	mp4 := filepath.Join(dir, "assets", "video.mp4")
	jpg := filepath.Join(dir, "assets", "poster.jpg")
	png := filepath.Join(dir, "assets", "profile.png")

	writeTestFile(t, mp4, "video")
	writeJPEGTestFile(t, jpg, color.RGBA{R: 40, G: 80, B: 120, A: 255})
	writePNGTestFile(t, png)

	if err := runGenerate([]string{
		publicDir,
		"/sha256/",
		module,
		"3",
		mp4,
		"mp4",
		jpg,
		"jpg",
		png,
		"profile",
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
		path       string
	}{
		{exportName: "mp4", path: mp4},
		{exportName: "jpg", path: jpg},
		{exportName: "profile", path: png},
	} {
		digestName, err := digestFileName(tc.path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(filepath.Join(publicDir, digestName)); err != nil {
			t.Fatalf("expected digest file for %s: %v", tc.exportName, err)
		}
		want := `export const ` + tc.exportName + ` = "/sha256/` + digestName + `";`
		if !strings.Contains(moduleContent, want) {
			t.Fatalf("generated module missing %q in:\n%s", want, moduleContent)
		}
	}

	for _, want := range []string{
		`export const jpgAverageColor = "`,
		`export const profileAverageColor = "#800080";`,
	} {
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
