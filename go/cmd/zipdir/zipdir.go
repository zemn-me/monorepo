package main

import (
	"flag"

	"github.com/zemnmez/quickcult/go/archive/zip/ziputil"
	"github.com/zemnmez/quickcult/go/flag/flagutil"
)

var output flagutil.FileFlagWC
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
