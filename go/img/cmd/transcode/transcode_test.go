package main

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/deepteams/webp"
)

func TestResizeWidthPreservesAspectRatio(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	got, err := Resize(src, ResizeOptions{Width: 100})
	if err != nil {
		t.Fatal(err)
	}

	assertSize(t, got, 100, 50)
}

func TestResizeContainFitsInsideBounds(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	got, err := Resize(src, ResizeOptions{
		Width:  100,
		Height: 100,
		Fit:    "contain",
	})
	if err != nil {
		t.Fatal(err)
	}

	assertSize(t, got, 100, 50)
}

func TestResizeUsesInterpolatingSampler(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.RGBA{A: 255})
	src.Set(1, 0, color.RGBA{R: 255, A: 255})

	got, err := Resize(src, ResizeOptions{
		Width:  1,
		Height: 1,
		Fit:    "contain",
	})
	if err != nil {
		t.Fatal(err)
	}

	r, _, _, a := got.At(0, 0).RGBA()
	if r < 0x7f00 || r > 0x8100 || a != 0xffff {
		t.Fatalf("got red=%#x alpha=%#x, want half red and full alpha", r, a)
	}
}

func TestResizeCoverFillsBounds(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	got, err := Resize(src, ResizeOptions{
		Width:  100,
		Height: 100,
		Fit:    "cover",
	})
	if err != nil {
		t.Fatal(err)
	}

	assertSize(t, got, 100, 100)
}

func TestResizeCoverCropScaleFillsBounds(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	got, err := Resize(src, ResizeOptions{
		Width:     100,
		Height:    100,
		Fit:       "cover",
		CropScale: 1.25,
	})
	if err != nil {
		t.Fatal(err)
	}

	assertSize(t, got, 100, 100)
}

func TestResizeRejectsCropScaleForContain(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	if _, err := Resize(src, ResizeOptions{
		Width:     100,
		Height:    100,
		Fit:       "contain",
		CropScale: 1.25,
	}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestResizeRejectsUnknownFit(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 400, 200))

	if _, err := Resize(src, ResizeOptions{
		Width: 100,
		Fit:   "stretch",
	}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestEncodeWebP(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 8, 8))
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			src.Set(x, y, color.RGBA{
				R: uint8(x * 32),
				G: uint8(y * 32),
				B: 128,
				A: 255,
			})
		}
	}

	var out bytes.Buffer
	if err := mimeToEncoder["image/webp"](&out, src, EncodeOptions{
		Quality: 80,
	}); err != nil {
		t.Fatal(err)
	}

	decoded, err := webp.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	assertSize(t, decoded, 8, 8)
}

func TestEncodeJPEGClampsQuality(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 8, 8))

	var out bytes.Buffer
	if err := mimeToEncoder["image/jpeg"](&out, src, EncodeOptions{
		Quality: 200,
	}); err != nil {
		t.Fatal(err)
	}

	decoded, err := jpeg.Decode(bytes.NewReader(out.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	assertSize(t, decoded, 8, 8)
}

func assertSize(t *testing.T, img image.Image, width, height int) {
	t.Helper()

	bounds := img.Bounds()
	if bounds.Dx() != width || bounds.Dy() != height {
		t.Fatalf(
			"got %dx%d, want %dx%d",
			bounds.Dx(),
			bounds.Dy(),
			width,
			height,
		)
	}
}
