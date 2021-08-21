package flagutil

import (
	"io"
	"io/fs"
	"os"
	"strings"
)

type ioCombiner struct {
	io.ReadCloser
	io.WriteCloser
}

func (i ioCombiner) Close() (err error) {
	err = i.ReadCloser.Close()
	err2 := i.WriteCloser.Close()
	if err2 != nil {
		err = err2
	}
	return
}

type nopWriter struct {
	io.Writer
}

func (n nopWriter) Close() (err error) { return nil }

type nopReader struct {
	io.Reader
}

func (n nopReader) Close() (err error) { return nil }

type FileFlag struct {
	io.ReadWriteCloser
	Flag  string
	Flags int
	Perm  fs.FileMode
}

func (f FileFlag) String() string {
	return f.Flag
}

func (f *FileFlag) Set(s string) (err error) {
	if strings.TrimSpace(s) == "-" {
		f.ReadWriteCloser = ioCombiner{
			ReadCloser:  nopReader{os.Stdin},
			WriteCloser: nopWriter{os.Stdout},
		}
		return
	}

	f.ReadWriteCloser, err = os.OpenFile(s, f.Flags, f.Perm)
	return
}

func (f *FileFlag) Close() (err error) {
	if f.ReadWriteCloser != nil {
		err = f.ReadWriteCloser.Close()
	}

	return
}
