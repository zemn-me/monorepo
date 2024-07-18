package ts

import (
	"os/exec"
	"path/filepath"

	"github.com/bazelbuild/rules_go/go/tools/bazel"
)

// Extract imports from a typescript file with given location.
//
// This function calls a rust binary that must be present in runfiles. As such,
// calling it from outside of Bazel will fail.
func ExtractImports(fileName string) (imports []string, err error) {
	runfilesBase, err := bazel.RunfilesPath()

	exec.Command(filepath.Join(runfilesBase, "rs/ts/cmd/extract_imports"), arg ...string)
}
