//go:build tools
// +build tools

package main

import (
	_ "google.golang.org/protobuf/encoding/protodelim"
	_ "google.golang.org/protobuf/types/known/durationpb"
)
