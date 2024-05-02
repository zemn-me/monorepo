package flagutil

import (
	"errors"
	"flag"
	"io"
	"io/fs"
	"os"
	"strings"
)

type FileLike interface {
	fs.File
	io.Writer
}

type ioCombiner struct {
	io.ReadCloser
	io.WriteCloser
}

// Stat() is unsupported and returns an error.
func (i ioCombiner) Stat() (fs.FileInfo, error) {
	return nil, errors.New("Unsupported")
}

func (i ioCombiner) Close() (err error) {
	err = i.ReadCloser.Close()
	err2 := i.WriteCloser.Close()
	if err2 != nil {
		err = err2
	}
	return
}

// FileFlag is a flag.Value which
// opens a file of the given input string.
//
// It recognises the special file name '-', which
// is considered to be stdin for reads and stdout
// for writes.
//
// If MinusValue is set, it will be used as the value
// of FileLike when the flag value is '-'.
type FileFlag struct {
	FileLike
	Flag  string
	Flags int
	Perm  fs.FileMode
	// if set, we fall back to this when '-' is specified.
	MinusValue FileLike
}

var _ flag.Value = &FileFlag{}

func (f *FileFlag) Set(s string) (err error) {
	if strings.TrimSpace(s) == "-" {
		if f.MinusValue != nil {
			f.FileLike = f.MinusValue
			return
		}
	}

	f.FileLike, err = os.OpenFile(s, f.Flags, f.Perm)
	return
}

func (f FileFlag) String() string {
	return f.Flag
}

func (f *FileFlag) Close() (err error) {
	if f.FileLike != nil {
		err = f.FileLike.Close()
	}

	return
}
