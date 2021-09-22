package flagutil

import (
	"io/fs"
	"os"
)

type DirFS struct {
	fs.FS
	flag string
}

func (d *DirFS) Set(s string) (err error) {
	d.flag = s
	d.FS = os.DirFS(d.flag)
	return
}

func (d DirFS) String() string {
	return d.flag
}
