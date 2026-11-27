package workflows_test

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

// Each pin names a repository tar produced by Bazel in act's archive format.
type actionCache map[string]string

func (a actionCache) Fetch(_ context.Context, name, url, ref, _ string) (string, error) {
	if a[name+"@"+ref] == "" || url != "https://github.com/"+name {
		return "", fmt.Errorf("undeclared action %s@%s in //ci/workflows:action_cache", url, ref)
	}
	return ref, nil
}

func (a actionCache) GetTarArchive(_ context.Context, name, sha, prefix string) (io.ReadCloser, error) {
	file, ok := a[name+"@"+sha]
	if !ok {
		return nil, fmt.Errorf("undeclared action %s@%s", name, sha)
	}
	repo, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	prefix = path.Clean(prefix)
	if prefix == "." {
		return repo, nil
	}
	defer repo.Close()

	// act also requests a single action.yml or a build context subdirectory.
	var buf bytes.Buffer
	subtree := tar.NewWriter(&buf)
	reader := tar.NewReader(repo)
	found := false
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if header.Typeflag == tar.TypeDir && strings.TrimSuffix(header.Name, "/") == prefix {
			found = true
			continue
		}
		if header.Name == prefix {
			header.Name = path.Base(prefix)
		} else if rest, ok := strings.CutPrefix(header.Name, prefix+"/"); ok && rest != "" {
			header.Name = rest
		} else {
			continue
		}
		found = true
		if err := subtree.WriteHeader(header); err != nil {
			return nil, err
		}
		if _, err := io.Copy(subtree, reader); err != nil {
			return nil, err
		}
	}
	if !found {
		return nil, os.ErrNotExist
	}
	if err := subtree.Close(); err != nil {
		return nil, err
	}
	return io.NopCloser(&buf), nil
}

// Standalone go test uses the same Bazel artifact as the sandboxed test.
var buildActionCache = sync.OnceValues(func() (string, error) {
	cmd := exec.Command("./sh/bin/bazel", "build", "//ci/workflows:action_cache")
	cmd.Dir = "../.."
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("building action cache: %w\n%s", err, output)
	}
	return filepath.Abs("../../dist/bin/ci/workflows/action_cache")
})

func bazelActions(t *testing.T) actionCache {
	t.Helper()
	pkg := filepath.Join(sourceRoot(t), "ci/workflows")
	root := filepath.Join(pkg, "action_cache")
	if os.Getenv("TEST_SRCDIR") == "" {
		var err error
		root, err = buildActionCache()
		require.NoError(t, err)
	}
	var lock map[string]string
	data, err := os.ReadFile(filepath.Join(pkg, "actions.lock.json"))
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(data, &lock))
	cache := actionCache{}
	for pin := range lock {
		cache[pin] = filepath.Join(root, filepath.FromSlash(pin)+".tar")
	}
	return cache
}

func TestActionCacheRequiresDeclaredRevision(t *testing.T) {
	cache := bazelActions(t)
	_, err := cache.Fetch(t.Context(), "actions/checkout", "https://github.com/actions/checkout", "undeclared", "")
	require.ErrorContains(t, err, "undeclared action")
	_, err = cache.GetTarArchive(t.Context(), "actions/checkout", "undeclared", "")
	require.ErrorContains(t, err, "undeclared action")
}

func TestActionCacheSubdirectory(t *testing.T) {
	// A repository can ship several actions, each with an action.yml.
	file := filepath.Join(t.TempDir(), "actions.tar")
	out, err := os.Create(file)
	require.NoError(t, err)
	writer := tar.NewWriter(out)
	require.NoError(t, writer.AddFS(fstest.MapFS{
		"action.yml":           {Data: []byte("root")},
		"sub/action.yml":       {Data: []byte("child")},
		"sub-other/action.yml": {Data: []byte("sibling")},
	}))
	require.NoError(t, writer.Close())
	require.NoError(t, out.Close())

	cache := actionCache{"owner/repo@rev": file}
	for _, prefix := range []string{"sub", "sub/action.yml"} {
		data, err := cache.GetTarArchive(t.Context(), "owner/repo", "rev", prefix)
		require.NoError(t, err)
		reader := tar.NewReader(data)
		header, err := reader.Next()
		require.NoError(t, err)
		require.Equal(t, "action.yml", header.Name)
		body, err := io.ReadAll(reader)
		require.NoError(t, err)
		require.Equal(t, "child", string(body))
		_, err = reader.Next()
		require.ErrorIs(t, err, io.EOF)
		require.NoError(t, data.Close())
	}
	_, err = cache.GetTarArchive(t.Context(), "owner/repo", "rev", "absent")
	require.ErrorIs(t, err, os.ErrNotExist)
}
