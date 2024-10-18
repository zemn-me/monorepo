//go:build tools
// +build tools

package tools

import (
	_ "github.com/bazelbuild/bazel-watcher/cmd/ibazel"
	_ "github.com/go-delve/delve/cmd/dlv"
	_ "github.com/itchyny/gojq"
	_ "github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen"
	_ "golang.org/x/tools/cmd/goimports"
	_ "honnef.co/go/tools/cmd/staticcheck"
)
