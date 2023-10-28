package main

import (
	"flag"

	"os"

	"github.com/zemn-me/monorepo/go/archive/zip/ziputil"
	"github.com/zemn-me/monorepo/go/flag/flagutil"
)

var output = flagutil.FileFlag{
	Flags: os.O_WRONLY | os.O_TRUNC | os.O_CREATE,
	Perm:  0777,
}

var input flagutil.DirFS

func init() {
	flag.Var(&output, "output", "target zip file (or '-' for stdout)")
	flag.Var(&input, "input", "Target directory")
}

func Do() (err error) {
	return ziputil.ZipFs(output, input)
}

func main() {
	defer output.Close()
	flag.Parse()
	if err := Do(); err != nil {
		return
	}
}
