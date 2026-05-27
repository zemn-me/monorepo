// Transcode transcodes to and from image formats.
package main

import (
	"flag"
	"fmt"
	"image"
	"io"
	"io/fs"
	"math"
	"mime"
	"os"
	"path"

	"golang.org/x/image/draw"

	"github.com/zemn-me/monorepo/go/flag/flagutil"
)

type InputImageFlag struct {
	flagutil.FileFlag
	Flags int
	Perm  fs.FileMode
	image.Image
}

type FileLike interface {
	io.ReadWriteCloser
	io.Seeker
}

func (i InputImageFlag) nil() bool {
	return i.FileFlag.FileLike == nil
}

func (f *InputImageFlag) Set(s string) (err error) {
	f.FileFlag.Flags = f.Flags
	f.FileFlag.Perm = f.Perm
	f.FileFlag.MinusValue = os.Stdin

	if err = f.FileFlag.Set(s); err != nil {
		return
	}

	var file FileLike
	var ok bool

	if file, ok = f.FileFlag.FileLike.(FileLike); !ok {
		return fmt.Errorf("%+v must be io.Seeker", f.FileFlag.FileLike)
	}

	cfg, format, err := image.DecodeConfig(file)
	if err != nil {
		return
	}

	mediaTypeFromFormat := "image/" + format

	// now we can determine if we know how to encode the image
	ext := path.Ext(s)
	mediaTypeFromPath := mime.TypeByExtension(ext)

	if mediaTypeFromPath != "" && mediaTypeFromPath != mediaTypeFromFormat {
		return fmt.Errorf("File %+q has format %+q, but its extension (%+q) indicates format %+q. What's going on here?", s, mediaTypeFromFormat, ext, mediaTypeFromPath)
	}

	if cfg.Width > 1_000_000 || cfg.Height > 1_000_000 {
		return fmt.Errorf("%d x %d is too big", cfg.Width, cfg.Height)
	}

	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return
	}

	f.Image, _, err = image.Decode(file)
	if err != nil {
		return
	}

	return
}

type OutputImageFlag struct {
	flagutil.FileFlag
	Flags   int
	Perm    fs.FileMode
	Encoder func(w io.Writer, m image.Image, options EncodeOptions) error
}

func (i OutputImageFlag) nil() bool {
	return i.FileFlag.FileLike == nil
}

func (f *OutputImageFlag) Set(s string) (err error) {
	f.FileFlag.Flags = f.Flags
	f.FileFlag.Perm = f.Perm
	f.FileFlag.MinusValue = os.Stdout

	if err = f.FileFlag.Set(s); err != nil {
		return
	}

	var ok bool

	ext := path.Ext(s)
	mediaType := mime.TypeByExtension(ext)

	if f.Encoder, ok = mimeToEncoder[mediaType]; !ok {
		return fmt.Errorf("%+q has detected MIME type %s, which is unsupported.", s, mediaType)
	}

	return
}

func (f OutputImageFlag) Encode(m image.Image, options EncodeOptions) error {
	if f.Encoder == nil {
		return fmt.Errorf("An image must be provided.")
	}
	return f.Encoder(f.FileFlag.FileLike, m, options)
}

var input = InputImageFlag{
	Flags: os.O_RDONLY,
}

var output = OutputImageFlag{
	Flags: os.O_WRONLY | os.O_TRUNC | os.O_CREATE,
	Perm:  0777,
}

var resizeOptions ResizeOptions
var encodeOptions EncodeOptions

func init() {
	flag.Var(&input, "input", "target file to transcode")
	flag.Var(&output, "output", "output file path")
	flag.IntVar(&resizeOptions.Width, "width", 0, "resize output to this width in pixels")
	flag.IntVar(&resizeOptions.Height, "height", 0, "resize output to this height in pixels")
	flag.StringVar(&resizeOptions.Fit, "fit", "contain", "resize fit mode: contain or cover")
	flag.Float64Var(&resizeOptions.CropScale, "crop_scale", 1, "crop inward by this factor before cover resize")
	flag.IntVar(&encodeOptions.Quality, "quality", 0, "lossy output quality from 1 to 100; 0 uses encoder default")
	flag.BoolVar(&encodeOptions.ProgressiveJPEG, "progressive_jpeg", false, "encode JPEG output in progressive mode")
}

func Do() (err error) {
	img, err := Resize(input.Image, resizeOptions)
	if err != nil {
		return err
	}

	return output.Encode(img, encodeOptions)
}

type ResizeOptions struct {
	Width     int
	Height    int
	Fit       string
	CropScale float64
}

func Resize(src image.Image, options ResizeOptions) (image.Image, error) {
	if options.CropScale == 0 {
		options.CropScale = 1
	}
	if options.CropScale < 1 {
		return nil, fmt.Errorf("crop_scale must be at least 1")
	}

	if options.Width == 0 && options.Height == 0 {
		if options.CropScale != 1 {
			return nil, fmt.Errorf("crop_scale requires resize dimensions")
		}
		return src, nil
	}

	if options.Width < 0 || options.Height < 0 {
		return nil, fmt.Errorf("width and height must be positive")
	}

	bounds := src.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()
	if srcWidth == 0 || srcHeight == 0 {
		return nil, fmt.Errorf("cannot resize empty image")
	}

	if options.Fit == "" {
		options.Fit = "contain"
	}

	switch options.Fit {
	case "contain":
		if options.CropScale != 1 {
			return nil, fmt.Errorf("crop_scale requires cover fit")
		}
		return contain(src, options.Width, options.Height), nil
	case "cover":
		return cover(src, options.Width, options.Height, options.CropScale)
	default:
		return nil, fmt.Errorf("unknown fit mode %q", options.Fit)
	}
}

func contain(src image.Image, width, height int) image.Image {
	srcBounds := src.Bounds()
	targetWidth, targetHeight := containedSize(
		srcBounds.Dx(),
		srcBounds.Dy(),
		width,
		height,
	)
	return scale(src, srcBounds, targetWidth, targetHeight)
}

func cover(src image.Image, width, height int, cropScale float64) (image.Image, error) {
	if width == 0 || height == 0 {
		return nil, fmt.Errorf("cover fit requires both width and height")
	}

	sourceBounds := coverSourceBounds(src.Bounds(), width, height)
	if cropScale > 1 {
		sourceBounds = cropBounds(sourceBounds, cropScale)
	}

	return scale(src, sourceBounds, width, height), nil
}

func containedSize(srcWidth, srcHeight, maxWidth, maxHeight int) (int, int) {
	switch {
	case maxWidth == 0:
		return scaleSize(srcWidth, srcHeight, float64(maxHeight)/float64(srcHeight))
	case maxHeight == 0:
		return scaleSize(srcWidth, srcHeight, float64(maxWidth)/float64(srcWidth))
	default:
		scaleFactor := math.Min(
			float64(maxWidth)/float64(srcWidth),
			float64(maxHeight)/float64(srcHeight),
		)
		return scaleSize(srcWidth, srcHeight, scaleFactor)
	}
}

func scaleSize(srcWidth, srcHeight int, scaleFactor float64) (int, int) {
	return max(1, int(math.Round(float64(srcWidth)*scaleFactor))),
		max(1, int(math.Round(float64(srcHeight)*scaleFactor)))
}

func coverSourceBounds(src image.Rectangle, targetWidth, targetHeight int) image.Rectangle {
	srcWidth := src.Dx()
	srcHeight := src.Dy()
	srcAspect := float64(srcWidth) / float64(srcHeight)
	targetAspect := float64(targetWidth) / float64(targetHeight)

	if srcAspect > targetAspect {
		width := int(math.Round(float64(srcHeight) * targetAspect))
		x := src.Min.X + (srcWidth-width)/2
		return image.Rect(x, src.Min.Y, x+width, src.Max.Y)
	}

	height := int(math.Round(float64(srcWidth) / targetAspect))
	y := src.Min.Y + (srcHeight-height)/2
	return image.Rect(src.Min.X, y, src.Max.X, y+height)
}

func cropBounds(src image.Rectangle, cropScale float64) image.Rectangle {
	width := max(1, int(math.Round(float64(src.Dx())/cropScale)))
	height := max(1, int(math.Round(float64(src.Dy())/cropScale)))
	x := src.Min.X + (src.Dx()-width)/2
	y := src.Min.Y + (src.Dy()-height)/2
	return image.Rect(x, y, x+width, y+height)
}

func scale(src image.Image, srcBounds image.Rectangle, width, height int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, srcBounds, draw.Over, nil)
	return dst
}

func main() {
	defer output.Close()
	defer input.Close()
	flag.Parse()
	if err := Do(); err != nil {
		flag.CommandLine.Usage()
		panic(err)
	}
}
