package main

import (
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"runtime"
	"strings"
)

var pathInSteam = path.Join("steamapps", "common", "Cultist Simulator", "cultistsimulator_Data", "StreamingAssets")

func globPaths() (paths []string, err error) {
	paths, err = steamFolderSearchPaths()
	if err != nil {
		return
	}

	paths = permutePaths(paths, pathInSteam)

	if runtime.GOOS == "windows" {
		for i := range paths {
			paths[i] = strings.ReplaceAll(paths[i], "\\", "\\\\")
		}
	}

	return paths, nil
}

func cultistGamepath() (s string, err error) {
	globs, err := globPaths()
	if err != nil {
		return
	}
	for _, path := range globs {
		var matches []string
		matches, err = filepath.Glob(path)
		if err != nil {
			return
		}

		if len(matches) != 0 {
			return matches[0], nil
		}
	}

	return "", errors.New("Unable to locate game.")
}

func Do() (err error) {
	gamePath, err := cultistGamepath()
	if err != nil {
		return
	}

	fmt.Println(gamePath)

	return
}

func main() {
	if err := Do(); err != nil {
		panic(err)
	}
}
