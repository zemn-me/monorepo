// +build !linux,!windows

package main

import (
	"runtime"
)

func steamFolderSearchPaths() (root []string, err error) {
	panic("Unimplemented for: " + runtime.GOOS)
}
