package apiserver

import (
	// Retain dependencies imported by server_gen, whose generated output is
	// outside the source tree scanned by go mod tidy.
	_ "github.com/oapi-codegen/runtime"
	_ "github.com/oapi-codegen/runtime/types"
)
