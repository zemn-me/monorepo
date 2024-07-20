package ts

import (
	"bytes"
	"os/exec"
	"path/filepath"

	"github.com/bazelbuild/rules_go/go/tools/bazel"
)

// Extract imports from a typescript file with given location.
//
// This function calls a rust binary that must be present in runfiles. As such,
// calling it from outside of Bazel will fail.
func ExtractImports(fileName string) (imports [][]byte, err error) {
	runfilesBase, err := bazel.RunfilesPath()

	var output bytes.Buffer
	cmd := exec.Command(filepath.Join(runfilesBase, "rs/ts/cmd/extract_imports"), fileName)
	cmd.Stdout = &output

	if err = cmd.Run(); err != nil {
		return
	}

	imports = bytes.Split(output.Bytes(), []byte("\n"))

	return
}
