//go:build tools
// +build tools

package tools

import (
	_ "github.com/bazelbuild/bazel-watcher/cmd/ibazel"
	_ "github.com/go-delve/delve/cmd/dlv"
	_ "github.com/itchyny/gojq"
	_ "golang.org/x/tools/cmd/goimports"
	_ "honnef.co/go/tools/cmd/staticcheck"
)
