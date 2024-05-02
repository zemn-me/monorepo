// Transcode transcodes to and from image formats.
package main

import (
	"flag"
	"fmt"
	"image"
	"io"
	"io/fs"
	"mime"
	"os"
	"path"

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
	Encoder func(w io.Writer, m image.Image) error
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

func (f OutputImageFlag) Encode(m image.Image) error {
	if f.Encoder == nil {
		return fmt.Errorf("An image must be provided.")
	}
	return f.Encoder(f.FileFlag.FileLike, m)
}

var input = InputImageFlag{
	Flags: os.O_RDONLY,
}

var output = OutputImageFlag{
	Flags: os.O_WRONLY | os.O_TRUNC | os.O_CREATE,
	Perm:  0777,
}

func init() {
	flag.Var(&input, "input", "target file to transcode")
	flag.Var(&output, "output", "output file path")
}

func Do() (err error) {
	return output.Encode(input.Image)
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
