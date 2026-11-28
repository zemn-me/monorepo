// Command renovate_bcr converts a gzipped Bazel Central Registry index into Renovate JSON feeds.
package main

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"

	bcr "github.com/bazel-contrib/bcr-frontend/build/stack/bazel/registry/v1"
	"google.golang.org/protobuf/proto"
)

type release struct {
	Version          string `json:"version"`
	ReleaseTimestamp string `json:"releaseTimestamp,omitempty"`
	IsDeprecated     bool   `json:"isDeprecated,omitempty"`
}

type feed struct {
	Homepage string    `json:"homepage,omitempty"`
	Releases []release `json:"releases"`
}

// Keep each feed in this directory, including BCR entries such as _builtins.
var moduleName = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

func moduleFeed(module *bcr.Module) feed {
	dates := make(map[string]string)
	for _, version := range module.GetVersions() {
		if date := version.GetCommit().GetDate(); date != "" {
			dates[version.GetVersion()] = date
		}
	}
	metadata := module.GetMetadata()
	result := feed{Homepage: metadata.GetHomepage(), Releases: make([]release, 0, len(metadata.GetVersions()))}
	for _, version := range metadata.GetVersions() {
		_, yanked := metadata.GetYankedVersions()[version]
		result.Releases = append(result.Releases, release{Version: version, ReleaseTimestamp: dates[version], IsDeprecated: yanked})
	}
	return result
}

func convert(indexPath, outputDir string) error {
	file, err := os.Open(indexPath)
	if err != nil {
		return err
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	var index bcr.Registry
	if err := proto.Unmarshal(data, &index); err != nil {
		return err
	}
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return err
	}
	for _, module := range index.GetModules() {
		if !moduleName.MatchString(module.GetName()) {
			continue
		}
		data, err := json.Marshal(moduleFeed(module))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(outputDir, module.GetName()+".json"), data, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "usage: renovate_bcr REGISTRY.pb.gz OUTPUT_DIR")
		os.Exit(2)
	}
	if err := convert(os.Args[1], os.Args[2]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
