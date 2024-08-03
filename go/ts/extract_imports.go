package ts

import (
	"bytes"
	"fmt"
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
	cmd := exec.Command(filepath.Join(runfilesBase, "rs/ts/cmd/extract_imports/extract_imports"), fileName)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = &output

	if err = cmd.Run(); err != nil {
		err = fmt.Errorf("ExtractImports: %v\n\n%+q", err, stderr.Bytes())
		return
	}

	imports = bytes.Split(bytes.TrimSpace(output.Bytes()), []byte("\n"))
	out := make([][]byte, 0, len(imports))

	for _, v := range imports {
		if len(v) == 0 {
			continue
		}
		out = append(out, v)
	}

	imports = out

	return
}
