package main

import (
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"

	"github.com/deepteams/webp"
	"github.com/dlecorfec/progjpeg"
)

type EncodeOptions struct {
	Quality         int
	ProgressiveJPEG bool
}

var mimeToEncoder = map[string]func(io.Writer, image.Image, EncodeOptions) error{
	"image/gif": func(w io.Writer, i image.Image, _ EncodeOptions) error {
		return gif.Encode(w, i, nil)
	},
	"image/png": func(w io.Writer, i image.Image, _ EncodeOptions) error {
		return png.Encode(w, i)
	},
	"image/jpeg": func(w io.Writer, i image.Image, options EncodeOptions) error {
		if options.ProgressiveJPEG {
			return progjpeg.Encode(w, i, progressiveJPEGEncodeOptions(options.Quality))
		}
		return jpeg.Encode(w, i, jpegEncodeOptions(options.Quality))
	},
	"image/webp": func(w io.Writer, i image.Image, options EncodeOptions) error {
		return webp.Encode(w, i, webpEncodeOptions(options.Quality))
	},
}

func progressiveJPEGEncodeOptions(quality int) *progjpeg.Options {
	if quality == 0 {
		return &progjpeg.Options{
			Quality:     progjpeg.DefaultQuality,
			Progressive: true,
		}
	}

	if quality < 1 {
		quality = 1
	}

	if quality > 100 {
		quality = 100
	}

	return &progjpeg.Options{
		Quality:     quality,
		Progressive: true,
	}
}

func jpegEncodeOptions(quality int) *jpeg.Options {
	if quality == 0 {
		return nil
	}

	if quality < 1 {
		quality = 1
	}

	if quality > 100 {
		quality = 100
	}

	return &jpeg.Options{Quality: quality}
}

func webpEncodeOptions(quality int) *webp.EncoderOptions {
	if quality == 0 {
		return webp.DefaultOptions()
	}

	if quality < 1 {
		quality = 1
	}

	if quality > 100 {
		quality = 100
	}

	return webp.OptionsForPreset(webp.PresetPhoto, float32(quality))
}
