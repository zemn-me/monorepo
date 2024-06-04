package main

import (
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
)

var mimeToEncoder = map[string]func(io.Writer, image.Image) error{
	"image/gif": func(w io.Writer, i image.Image) error {
		return gif.Encode(w, i, nil)
	},
	"image/png": func(w io.Writer, i image.Image) error {
		return png.Encode(w, i)
	},
	"image/jpeg": func(w io.Writer, i image.Image) error {
		return jpeg.Encode(w, i, nil)
	},
}
