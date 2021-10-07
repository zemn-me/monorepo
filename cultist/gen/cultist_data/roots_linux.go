// +build linux

package main

import (
	"os"
	"path"
)

var HOME string

func init() {
	HOME = os.Getenv("HOME")
	if HOME == "" {
		panic("Cannot locate $HOME")
	}
}

func steamFolderSearchPaths() (root []string, err error) {
	return permutePaths(
		append(
			permutePaths([]string{path.Join("/", "mnt", "*")}, "Program Files", "Program Files (x86)"),
			path.Join(HOME, ".local", "share"),
		),
		"Steam",
	), nil
}
