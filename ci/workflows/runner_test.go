package workflows_test

import (
	"context"
	"encoding/json"
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
)

type fixture struct {
	root, repo, sha string
	actions         runner.ActionCache
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
	cache := bazelActions(t)
	local := &runner.LocalRepositoryCache{
		Parent:            cache,
		LocalRepositories: map[string]string{},
		CacheDirCache:     map[string]string{},
	}
	f := &fixture{root: root, repo: filepath.Join(root, "repo"), actions: local}
	// The disk cleanup composite would remove system packages on the host.
	// Keep its pin in the cache but give this workflow fixture a harmless step.
	for pin := range cache {
		if strings.HasPrefix(pin, "jlumbroso/free-disk-space@") {
			dir := filepath.Join(root, "disk-cleanup")
			require.NoError(t, writeFile(filepath.Join(dir, "action.yml"), `name: Disk cleanup fixture
description: Skip cleanup on the test host
runs:
  using: composite
  steps:
    - shell: bash
      run: "true"
`, 0644))
			local.LocalRepositories["https://github.com/"+pin] = dir
		}
	}
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
		"py/__init__.py",
		"py/ci/__init__.py",
		"py/ci/find_deploy_bundle.py",
		"py/ci/verify_staging_candidate.py",
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
	binary, err := os.Executable()
	require.NoError(t, err)
	require.NoError(t, os.Symlink(binary, filepath.Join(root, "bin/node")))
	require.NoError(t, writeFile(filepath.Join(root, "statuses"), "", 0600))
	require.NoError(t, writeFile(filepath.Join(root, "deployments"), "", 0600))
	f.git(t, "init", "-q", "-b", "main")
	f.git(t, "remote", "add", "origin", "https://github.com/owner/repo")
	// The fixture Bazel packages deploy.ts so a deployed bundle identifies its source.
	require.NoError(t, writeFile(filepath.Join(f.repo, "ci/deploy/deploy.ts"), "candidate program", 0644))
	require.NoError(t, writeFile(filepath.Join(f.repo, "ci/deploy/BUILD.bazel"), "# candidate targets\n", 0644))
	for _, name := range packaging {
		if name != "run.sh" {
			require.NoError(t, writeFile(filepath.Join(f.repo, "ci/deploy", name), "candidate packaging", 0644))
		}
	}
	f.git(t, "config", "user.name", "Test")
	f.git(t, "config", "user.email", "test@example.org")
	f.git(t, "add", ".")
	f.git(t, "commit", "-qm", "workflow fixture")
	f.sha = f.git(t, "rev-parse", "HEAD")
	f.git(t, "branch", queueBranch, f.sha)
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

func (f *fixture) planJob(t *testing.T, name, event, job string) *model.Plan {
	t.Helper()
	path := filepath.Join(f.repo, ".github/workflows", name+".yml")
	planner, err := model.NewSingleWorkflowPlanner(path, strings.NewReader(queueSetting.ReplaceAllString(readFile(t, path), "")))
	require.NoError(t, err)
	require.Contains(t, planner.GetEvents(), event)
	plan, err := planner.PlanJob(job)
	require.NoError(t, err)
	return plan
}

func (f *fixture) run(t *testing.T, name, event, job, want string, overrides map[string]string) {
	t.Helper()
	f.runPlan(t, name, event, job, want, overrides, f.planJob(t, name, event, job))
}

func (f *fixture) runPlan(t *testing.T, name, event, job, want string, overrides map[string]string, plan *model.Plan) {
	t.Helper()
	binary, err := os.Executable()
	require.NoError(t, err)
	env := map[string]string{
		"GITHUB_RUN_ID":          "42",
		"GITHUB_RUN_ATTEMPT":     "3",
		"FIXTURE_BIN":            binary,
		"FIXTURE_REPO":           f.repo,
		"FIXTURE_STORE":          filepath.Join(f.root, "artifacts"),
		"FIXTURE_DISPATCH":       filepath.Join(f.root, "dispatch.json"),
		"FIXTURE_STATUSES":       filepath.Join(f.root, "statuses"),
		"FIXTURE_DEPLOYMENTS":    filepath.Join(f.root, "deployments"),
		"FIXTURE_BUILD":          filepath.Join(f.root, "build.json"),
		"FIXTURE_SUBMIT_ACTIONS": filepath.Join(f.root, "submit-actions"),
		"FIXTURE_SHA":            f.sha,
		"MAIN_SHA":               f.sha,
		"CACHE_SECRET":           "available",
		"PRODUCER_RESULT":        "success",
	}
	eventFile := "event.json"
	if event == "workflow_dispatch" {
		eventFile = "dispatch.json"
		env["SHA_REF"] = f.sha
		env["GITHUB_RUN_ID"] = "73"
		env["GITHUB_RUN_ATTEMPT"] = "1"
	}
	if event == "merge_group" {
		// act does not derive the synthetic ref and event SHA for merge_group.
		env["SHA_REF"] = f.sha
		env["GITHUB_REF"], env["GITHUB_REF_NAME"] = "refs/heads/"+queueBranch, queueBranch
	}
	maps.Copy(env, overrides)
	r, err := runner.New(&runner.Config{
		Workdir:        f.repo,
		ActionCacheDir: filepath.Join(f.root, "cache"),
		ActionCache:    f.actions,
		ConcurrentJobs: 1,
		EventName:      event,
		EventPath:      filepath.Join(f.root, eventFile),
		Env:            env,
		Platforms:      map[string]string{"ubuntu-latest": "-self-hosted"},
		GitHubInstance: "github.com",
		RemoteName:     "origin",
		DefaultBranch:  "main",
		Actor:          "workflow-test",
		Token:          "offline-workflow-token",
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
