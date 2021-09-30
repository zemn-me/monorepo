package main

import (
	"path"
)

func joinPaths(left []string, right string) []string {
	var out []string = make([]string, len(left))

	for i, l := range left {
		out[i] = path.Join(l, right)
	}

	return out
}

func permutePaths(left []string, right ...string) []string {
	var out []string = make([]string, 0, len(left)*len(right))
	for _, r := range right {
		out = append(out, joinPaths(left, r)...)
	}

	return out
}
