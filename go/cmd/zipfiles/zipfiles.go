package main

import (
	"archive/zip"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/zemn-me/monorepo/go/flag/flagutil"
)

var output flagutil.FileFlag

const help = `zipfiles -output [target] [files...]
	Zipfiles takes a set of files and produces a zip file
	that is based in the longest common denominator
	of the paths of those files.

	For example:

		zipfiles -output out.zip /home/thomas/files/cool.png \
			/home/thomas/files/cool2.png /home/thomas/files/extra/cool3.png

	Will produce a zip file containing cool.png, cool2.png and
	extra/cool3.png
`

func init() {
	flag.Var(&output, "output", "target zip file (or '-' for stdout)")

	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), help)
		flag.PrintDefaults()
	}
}

func hasCommonPrefix(prefix string, s ...string) bool {
	for _, v := range s {
		if !strings.HasPrefix(v, prefix) {
			return false
		}
	}

	return true
}

func commonPrefix(s ...string) string {
	var i int

	for ; ; i++ {
		if i > len(s[0]) || !hasCommonPrefix(s[0][:i], s[1:]...) {
			return s[0][:i]
		}
	}
}

func main() {
	defer output.Close()
	flag.Parse()

	if err := Do(); err != nil {
		panic(err)
	}
}

func Do() (err error) {
	var filePaths = flag.CommandLine.Args()

	for i, path := range filePaths {
		filePaths[i] = filepath.Clean(path)
	}

	z := zip.NewWriter(output)
	defer z.Close()

	prefix := commonPrefix(filePaths...)

	for _, filepath := range filePaths {
		var file = flagutil.FileFlag{
			Flags: os.O_RDONLY,
		}

		file.Set(filepath)

		defer file.Close()

		dst, err := z.Create(strings.TrimPrefix(filepath, prefix))

		if err != nil {
			return err
		}

		_, err = io.Copy(dst, file)

		if err != nil {
			return err
		}
	}

	return nil
}
