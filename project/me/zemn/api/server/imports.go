package apiserver

import (
	// allows go mod and gazelle to generate imports correctly.
	_ "github.com/oapi-codegen/runtime"
	_ "github.com/oapi-codegen/runtime/types"
	_ "github.com/oapi-codegen/runtime/strictmiddleware/nethttp"
)
