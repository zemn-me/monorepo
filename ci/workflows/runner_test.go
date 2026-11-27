package workflows_test

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/nektos/act/pkg/model"
	"github.com/nektos/act/pkg/runner"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// act asks this cache for action.yml by itself and for the whole action archive.
// Both requests return the same one-file tar. An unexpected action fails offline.
type actionCache map[string][]byte

func (a actionCache) Fetch(_ context.Context, name, url, ref, _ string) (string, error) {
	if _, ok := a[name]; !ok || url != "https://github.com/"+name {
		return "", fmt.Errorf("no fixture for %s@%s", url, ref)
	}
	return ref, nil
}

func (a actionCache) GetTarArchive(_ context.Context, name, _, path string) (io.ReadCloser, error) {
	if path != "" && path != "action.yml" {
		return nil, os.ErrNotExist
	}
	return io.NopCloser(bytes.NewReader(a[name])), nil
}

func externalActions(t *testing.T) actionCache {
	t.Helper()
	cache := actionCache{}
	for name, args := range map[string][]string{
		"actions/checkout":                                {"checkout", "path", "ref"},
		"actions/upload-artifact":                         {"upload", "name", "path", "if-no-files-found"},
		"actions/download-artifact":                       {"download", "run-id", "name", "path"},
		"google-github-actions/get-secretmanager-secrets": {"secrets", "secrets"},
		"google-github-actions/auth":                      nil,
		"aws-actions/configure-aws-credentials":           nil,
		"jlumbroso/free-disk-space":                       nil,
	} {
		inputs := map[string]model.Input{}
		outputs := map[string]model.Output{}
		step := map[string]any{"shell": "bash", "run": "true"}
		if len(args) != 0 {
			env := map[string]string{}
			command := []string{`"$FIXTURE_BIN" --service`, args[0]}
			for i, key := range args[1:] {
				inputs[key] = model.Input{Description: key}
				arg := fmt.Sprintf("ARG_%d", i)
				env[arg] = "${{ inputs." + key + " }}"
				command = append(command, `"$`+arg+`"`)
			}
			step["env"], step["run"] = env, strings.Join(command, " ")
			if args[0] == "secrets" {
				step["id"] = "result"
				for _, key := range []string{"buildbuddy_api_key", "readonly_buildbuddy_api_key"} {
					outputs[key] = model.Output{Description: key, Value: "${{ steps.result.outputs." + key + " }}"}
				}
			}
		}
		data, err := yaml.Marshal(map[string]any{
			"name": name, "description": "Offline service fixture", "inputs": inputs, "outputs": outputs,
			"runs": map[string]any{"using": "composite", "steps": []any{step}},
		})
		require.NoError(t, err)
		var buf bytes.Buffer
		tw := tar.NewWriter(&buf)
		require.NoError(t, tw.WriteHeader(&tar.Header{Name: "action.yml", Mode: 0644, Size: int64(len(data))}))
		_, err = tw.Write(data)
		require.NoError(t, err)
		require.NoError(t, tw.Close())
		cache[name] = buf.Bytes()
	}
	return cache
}

type fixture struct {
	root, repo, sha string
	actions         actionCache
}

func sourceRoot(t *testing.T) string {
	t.Helper()
	if dir := os.Getenv("TEST_SRCDIR"); dir != "" {
		return filepath.Join(dir, os.Getenv("TEST_WORKSPACE"))
	}
	root, err := filepath.Abs("../..")
	require.NoError(t, err)
	return root
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	return string(data)
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	src := sourceRoot(t)
	root := t.TempDir()
	f := &fixture{root: root, repo: filepath.Join(root, "repo"), actions: externalActions(t)}
	// act's host executor passes the test process environment to every step.
	// Give it a private home and only the commands these workflows exercise.
	for _, entry := range os.Environ() {
		key, _, _ := strings.Cut(entry, "=")
		t.Setenv(key, "")
		require.NoError(t, os.Unsetenv(key))
	}
	t.Setenv("HOME", root)
	t.Setenv("PATH", filepath.Join(root, "bin")+":/usr/bin:/bin")
	t.Setenv("GIT_CONFIG_NOSYSTEM", "1")
	for _, rel := range []string{
		".github/workflows/presubmit.yml",
		".github/workflows/staging.yml",
		".github/workflows/staging-pr.yml",
		".github/workflows/submit.yml",
		".github/workflows/bootstrap_bazel_remote_cache.sh",
		".github/workflows/prepare_ci.sh",
		".github/actions/build-deploy-bundle/action.yml",
		".github/actions/build-deploy-bundle/build.sh",
		".github/actions/upload-deploy-bundle/action.yml",
		"py/ci/find_deploy_bundle.py",
	} {
		mode := os.FileMode(0644)
		if filepath.Ext(rel) == ".sh" {
			mode = 0755
		}
		require.NoError(t, writeFile(filepath.Join(f.repo, rel), readFile(t, filepath.Join(src, rel)), mode))
	}
	for path, service := range map[string]string{
		filepath.Join(root, "bin/gh"):             "gh",
		filepath.Join(f.repo, "sh/bin/bazel"):     "bazel",
		filepath.Join(f.repo, "ci/deploy/run.sh"): "deploy",
	} {
		require.NoError(t, writeFile(path, "#!/bin/sh\nexec \"$FIXTURE_BIN\" --service "+service+" \"$@\"\n", 0755))
	}
	require.NoError(t, writeFile(filepath.Join(root, "bin/sleep"), "#!/bin/sh\ntest \"$1\" = 30\n", 0755))
	require.NoError(t, writeFile(filepath.Join(root, "deployments"), "", 0600))
	f.git(t, "init", "-q", "-b", "main")
	f.git(t, "remote", "add", "origin", "https://github.com/owner/repo")
	f.git(t, "add", ".")
	f.git(t, "-c", "user.name=Test", "-c", "user.email=test@example.org", "commit", "-qm", "workflow fixture")
	f.sha = f.git(t, "rev-parse", "HEAD")
	event, err := json.Marshal(map[string]any{
		"ref":          "refs/heads/main",
		"after":        f.sha,
		"number":       1,
		"pull_request": map[string]any{"number": 1, "base": map[string]string{"ref": "main"}},
	})
	require.NoError(t, err)
	require.NoError(t, writeFile(filepath.Join(root, "event.json"), string(event), 0644))
	return f
}

func (f *fixture) git(t *testing.T, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = f.repo
	data, err := cmd.CombinedOutput()
	require.NoError(t, err, "%s", data)
	return strings.TrimSpace(string(data))
}

type stepLog struct{ t *testing.T }

func (l stepLog) WithJobLogger() *logrus.Logger {
	log := logrus.New()
	log.SetOutput(io.Discard)
	log.AddHook(l)
	return log
}
func (l stepLog) Levels() []logrus.Level { return logrus.AllLevels }
func (l stepLog) Fire(e *logrus.Entry) error {
	if e.Data["raw_output"] == true && strings.Contains(e.Message, marker) {
		l.t.Error("workflow printed the fixture cache credential")
	}
	l.t.Log(e.Message)
	return nil
}

// GitHub enforces concurrency.queue. act v0.2.98 rejects it during parsing.
var queueSetting = regexp.MustCompile("(?m)^ +queue: (max|single)\n")

func (f *fixture) run(t *testing.T, name, event, job, want string, overrides map[string]string) {
	t.Helper()
	path := filepath.Join(f.repo, ".github/workflows", name+".yml")
	planner, err := model.NewSingleWorkflowPlanner(path, strings.NewReader(queueSetting.ReplaceAllString(readFile(t, path), "")))
	require.NoError(t, err)
	require.Contains(t, planner.GetEvents(), event)
	plan, err := planner.PlanJob(job)
	require.NoError(t, err)
	binary, err := os.Executable()
	require.NoError(t, err)
	env := map[string]string{
		"GITHUB_RUN_ID":       "42",
		"GITHUB_RUN_ATTEMPT":  "3",
		"FIXTURE_BIN":         binary,
		"FIXTURE_REPO":        f.repo,
		"FIXTURE_STORE":       filepath.Join(f.root, "artifacts"),
		"FIXTURE_DEPLOYMENTS": filepath.Join(f.root, "deployments"),
		"FIXTURE_BUILD":       filepath.Join(f.root, "build.json"),
		"FIXTURE_MAIN":        filepath.Join(f.root, "pinned"),
		"FIXTURE_SHA":         f.sha,
		"MAIN_SHA":            f.sha,
		"CACHE_SECRET":        "available",
		"PRODUCER_RESULT":     "success",
	}
	if name == "staging" {
		env["GITHUB_RUN_ID"] = "73"
		env["GITHUB_RUN_ATTEMPT"] = "1"
	}
	if event == "merge_group" {
		// act does not derive the synthetic ref from the merge_group event.
		f.git(t, "checkout", "-qB", queueBranch)
		env["GITHUB_REF"], env["GITHUB_REF_NAME"] = "refs/heads/"+queueBranch, queueBranch
	}
	maps.Copy(env, overrides)
	r, err := runner.New(&runner.Config{
		Workdir:        f.repo,
		ActionCacheDir: filepath.Join(f.root, "cache"),
		ActionCache:    f.actions,
		ConcurrentJobs: 1,
		EventName:      event,
		EventPath:      filepath.Join(f.root, "event.json"),
		Env:            env,
		Platforms:      map[string]string{"ubuntu-latest": "-self-hosted"},
		GitHubInstance: "github.com",
		RemoteName:     "origin",
		DefaultBranch:  "main",
		Actor:          "workflow-test",
		NoSkipCheckout: true,
		LogOutput:      true,
	})
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(t.Context(), 40*time.Second)
	defer cancel()
	err = r.NewPlanExecutor(plan)(runner.WithJobLoggerFactory(ctx, stepLog{t}))
	if want == "success" {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
	}
	// A dependency's failure can fail the plan even when the required gate passes.
	for _, stage := range plan.Stages {
		for _, run := range stage.Runs {
			if run.JobID == job {
				require.Equal(t, want, run.Job().Result, "%s.%s", name, job)
				return
			}
		}
	}
	t.Fatalf("act did not plan %s.%s", name, job)
}
