package main

import (
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"

	bcr "github.com/bazel-contrib/bcr-frontend/build/stack/bazel/registry/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

func TestRegistryIndexToRenovateFeed(t *testing.T) {
	index := &bcr.Registry{Modules: []*bcr.Module{{
		Name: "example",
		Metadata: &bcr.ModuleMetadata{
			Homepage:       "https://example.test",
			Versions:       []string{"1.0", "1.0.bcr.1", "1.1"},
			YankedVersions: map[string]string{"1.0": "Withdrawn"},
		},
		Versions: []*bcr.ModuleVersion{
			{Version: "1.0", Commit: &bcr.ModuleCommit{Date: "2026-01-01T10:00:00Z"}},
			{Version: "1.0.bcr.1", Commit: &bcr.ModuleCommit{Date: "2026-03-01T10:00:00Z"}},
			{Version: "2.0", Commit: &bcr.ModuleCommit{Date: "2026-03-02T10:00:00Z"}},
		},
	}, {
		Name:     "_builtins",
		Versions: []*bcr.ModuleVersion{{Version: "1.1", Commit: &bcr.ModuleCommit{Date: "2026-03-03T10:00:00Z"}}},
	}, {
		Name: "../outside",
	}}}
	dir := t.TempDir()
	path := filepath.Join(dir, "registry.pb.gz")
	data, err := proto.Marshal(index)
	require.NoError(t, err)
	file, err := os.Create(path)
	require.NoError(t, err)
	writer := gzip.NewWriter(file)
	_, err = writer.Write(data)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	require.NoError(t, file.Close())

	output := filepath.Join(dir, "bcr")
	require.NoError(t, convert(path, output))
	result, err := os.ReadFile(filepath.Join(output, "example.json"))
	require.NoError(t, err)
	require.JSONEq(t, `{
		"homepage": "https://example.test",
		"releases": [
			{"version":"1.0","releaseTimestamp":"2026-01-01T10:00:00Z","isDeprecated":true},
			{"version":"1.0.bcr.1","releaseTimestamp":"2026-03-01T10:00:00Z"},
			{"version":"1.1"}
		]
	}`, string(result))
	require.FileExists(t, filepath.Join(output, "_builtins.json"))
	require.NoFileExists(t, filepath.Join(dir, "outside.json"))
}
