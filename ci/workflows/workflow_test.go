package workflows_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nektos/act/pkg/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func (f *fixture) publishMain(t *testing.T, sha string) {
	t.Helper()
	require.NoError(t, writeArchives(filepath.Join(f.root, "artifacts", "11", "deploy-v2-main-"+sha), sha))
}

func (f *fixture) deployments(t *testing.T) []string {
	t.Helper()
	return strings.FieldsFunc(readFile(t, filepath.Join(f.root, "deployments")), func(r rune) bool { return r == '\n' })
}

func TestMergeGroupDeploysTestedBundleAfterMain(t *testing.T) {
	f := newFixture(t)
	f.publishMain(t, "pinned-main")
	f.run(t, "presubmit", "merge_group", "Presubmit", "success", nil)
	f.run(t, "staging", "merge_group", "Staging", "success", map[string]string{"MAIN_SHA": "pinned-main"})
	require.Equal(t, []string{"main pinned-main", "candidate " + f.sha}, f.deployments(t))
}

func TestStagingRejectsAdvancedQueueRef(t *testing.T) {
	f := newFixture(t)
	f.publishMain(t, "pinned-main")
	f.run(t, "presubmit", "merge_group", "Presubmit", "success", nil)
	f.git(t, "checkout", "-q", queueBranch)
	f.git(t, "commit", "--allow-empty", "-qm", "queue advanced")
	f.git(t, "checkout", "-q", "main")
	f.run(t, "staging", "merge_group", "Staging", "failure", map[string]string{"MAIN_SHA": "pinned-main"})
	require.Empty(t, f.deployments(t))
}

func TestFailuresReachRequiredGate(t *testing.T) {
	f := newFixture(t)
	f.publishMain(t, "pinned-main")
	f.run(t, "presubmit", "merge_group", "Presubmit", "failure", map[string]string{"FAIL_PRESUBMIT": "true"})
	require.NoDirExists(t, filepath.Join(f.root, "artifacts", "42"))
	// A producer can publish its candidate before a later step fails or is cancelled.
	f.run(t, "presubmit", "merge_group", "Presubmit", "success", nil)
	for _, result := range []string{"failure", "cancelled"} {
		t.Run(result, func(t *testing.T) {
			f.run(t, "staging", "merge_group", "Staging", "failure", map[string]string{"MAIN_SHA": "pinned-main", "PRODUCER_RESULT": result})
			require.Empty(t, f.deployments(t))
		})
	}
	for _, stage := range []string{"main", "candidate"} {
		t.Run(stage, func(t *testing.T) {
			require.NoError(t, writeFile(filepath.Join(f.root, "deployments"), "", 0600))
			f.run(t, "staging", "merge_group", "Staging", "failure", map[string]string{"MAIN_SHA": "pinned-main", "FAIL_DEPLOY": stage})
			want := []string{"main pinned-main"}
			if stage == "candidate" {
				want = append(want, "candidate "+f.sha)
			}
			require.Equal(t, want, f.deployments(t))
		})
	}
}

func TestStagingRejectsCancelledDeployment(t *testing.T) {
	f := newFixture(t)
	plan := f.planJob(t, "staging", "merge_group", "Staging")
	// GitHub can cancel Deploy while the required gate still runs with always().
	// Resume the real plan at the gate with that hosted-runner result.
	plan.Stages = plan.Stages[len(plan.Stages)-1:]
	gate := plan.Stages[0].Runs[0]
	require.Equal(t, "Staging", gate.JobID)
	require.Contains(t, gate.Job().Needs(), "Deploy")
	gate.Workflow.Jobs["Deploy"].Result = "cancelled"
	f.runPlan(t, "staging", "merge_group", "Staging", "failure", nil, plan)
}

func TestPullRequestChecksWithoutPublishingOrDeploying(t *testing.T) {
	f := newFixture(t)
	f.run(t, "presubmit", "pull_request", "Presubmit", "success", nil)
	f.run(t, "staging-pr", "pull_request", "Staging", "success", nil)
	require.NoDirExists(t, filepath.Join(f.root, "artifacts"))
	require.Empty(t, f.deployments(t))
}

func (f *fixture) build(t *testing.T) buildRecord {
	t.Helper()
	var record buildRecord
	require.NoError(t, json.Unmarshal([]byte(readFile(t, filepath.Join(f.root, "build.json"))), &record))
	return record
}

func TestPresubmitCache(t *testing.T) {
	f := newFixture(t)
	f.run(t, "presubmit", "pull_request", "Presubmit", "success", nil)
	build := f.build(t)
	require.Contains(t, build.Args, "--config=ci-presubmit")
	require.Contains(t, build.Config, "--remote_cache=grpcs://remote.buildbuddy.io")
	require.Contains(t, build.Config, "--remote_upload_local_results=false")
	for _, service := range []string{"cache", "exec"} {
		require.Contains(t, build.Config, "--remote_"+service+"_header=x-buildbuddy-api-key="+marker)
	}
	require.NotContains(t, build.Config, "--remote_header=")
	require.NotContains(t, build.Config, "--bes_backend=")
	f.run(t, "presubmit", "pull_request", "Presubmit", "success", map[string]string{"CACHE_SECRET": "missing"})
	build = f.build(t)
	require.False(t, build.HasConfig)
	require.Contains(t, build.Args, "--config=ci-local")
}

func TestMissingMainArtifactBuildsPinnedProgram(t *testing.T) {
	f := newFixture(t)
	deploy := filepath.Join(f.repo, "ci/deploy")
	var candidatePackaging []string
	for _, name := range packaging {
		candidatePackaging = append(candidatePackaging, readFile(t, filepath.Join(deploy, name)))
	}
	for _, hasPackager := range []bool{true, false} {
		name := "before-packager"
		if hasPackager {
			name = "with-packager"
		}
		t.Run(name, func(t *testing.T) {
			f.git(t, "checkout", "-q", "--detach", f.sha)
			require.NoError(t, writeFile(filepath.Join(deploy, "deploy.ts"), "pinned program", 0644))
			require.NoError(t, writeFile(filepath.Join(deploy, "BUILD.bazel"), "# pinned targets\n", 0644))
			for _, name := range packaging {
				path := filepath.Join(deploy, name)
				if hasPackager {
					require.NoError(t, writeFile(path, "main packaging", 0644))
				} else {
					require.NoError(t, os.Remove(path))
				}
			}
			f.git(t, "add", "-A")
			f.git(t, "commit", "-qm", name)
			revision := f.git(t, "rev-parse", "HEAD")
			f.git(t, "checkout", "-q", "main")
			f.run(t, "staging", "merge_group", "MainBundle", "success", map[string]string{"MAIN_SHA": revision})
			build := f.build(t)
			require.Contains(t, build.Args, "//ci/deploy:bundle_test")
			require.Contains(t, build.Args, "--config=ci")
			require.Contains(t, build.Config, "--remote_cache=grpcs://remote.buildbuddy.io")
			require.Contains(t, build.Config, "--remote_header=x-buildbuddy-api-key="+marker)
			require.Contains(t, build.Config, "--bes_backend=grpcs://remote.buildbuddy.io")
			require.NotContains(t, build.Config, "--remote_upload_local_results=false")
			for _, archive := range []string{"ape", "rules_diff"} {
				require.Contains(t, build.Args, "--distdir="+build.Workspace+"/third_party/bazel_distdir/"+archive)
			}
			require.Contains(t, build.BuildFile, "# pinned targets")
			wantPackaging := candidatePackaging
			if hasPackager {
				require.NotContains(t, build.BuildFile, "deploy_bundle()")
				wantPackaging = slices.Repeat([]string{"main packaging"}, len(packaging))
			} else {
				require.Contains(t, build.BuildFile, "deploy_bundle()")
			}
			require.Equal(t, wantPackaging, build.Packaging)
			for _, name := range archives {
				require.Equal(t, "pinned program", readFile(t, filepath.Join(f.root, "artifacts", "73", "deploy-v2-main-"+revision, name)))
			}
		})
	}
}

func TestSubmitPublishesAndDeploysNewMain(t *testing.T) {
	f := newFixture(t)
	f.run(t, "submit", "push", "Submit", "success", nil)
	for _, archive := range archives {
		require.Equal(t, "candidate program", readFile(t, filepath.Join(f.root, "artifacts", "42", "deploy-v2-main-"+f.sha, archive)))
	}
	require.Equal(t, []string{"production candidate program"}, f.deployments(t))
}

func TestProductionChecksMainBeforeDeploying(t *testing.T) {
	f := newFixture(t)
	f.publishMain(t, f.sha)
	for _, tc := range []struct {
		name, current, result, failDeploy string
		deployed                          bool
	}{
		{"superseded", "newer", "success", "", false},
		{"lookup failed", "api-error", "failure", "", false},
		{"deployment failed", f.sha, "failure", "production", true},
		{"current", f.sha, "success", "", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, writeFile(filepath.Join(f.root, "deployments"), "", 0600))
			actions := filepath.Join(f.root, "submit-actions")
			require.NoError(t, writeFile(actions, "", 0600))
			f.run(t, "submit", "push", "Submit", tc.result, map[string]string{"MAIN_SHA": tc.current, "FAIL_DEPLOY": tc.failDeploy})
			if tc.deployed {
				require.Contains(t, readFile(t, actions), "aws-actions/configure-aws-credentials")
				require.Equal(t, []string{"production " + f.sha}, f.deployments(t))
			} else {
				require.Empty(t, f.deployments(t))
				require.Empty(t, readFile(t, actions))
			}
		})
	}
}

func TestHostedRunnerContracts(t *testing.T) {
	// GitHub controls permissions, the deploy lock, and which jobs satisfy a required check.
	dir := filepath.Join(sourceRoot(t), ".github/workflows")
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	providers := map[string][]string{}
	for _, entry := range entries {
		ext := filepath.Ext(entry.Name())
		if ext != ".yml" && ext != ".yaml" {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		name := strings.TrimSuffix(entry.Name(), ext)
		var workflow struct {
			On   yaml.Node
			Jobs map[string]struct {
				Name        string
				Permissions yaml.Node
				Concurrency yaml.Node
			}
		}
		require.NoError(t, yaml.Unmarshal([]byte(readFile(t, path)), &workflow))
		for id, job := range workflow.Jobs {
			if job.Name == "Staging" || (job.Name == "" && id == "Staging") {
				for _, event := range (&model.Workflow{RawOn: workflow.On}).On() {
					providers[event] = append(providers[event], name)
				}
			}
		}
		if deploy, ok := map[string]string{"staging": "Deploy", "submit": "Submit"}[name]; ok {
			require.Contains(t, workflow.Jobs, deploy)
			for id, job := range workflow.Jobs {
				var concurrency struct{ Group, Queue string }
				switch job.Concurrency.Kind {
				case yaml.MappingNode:
					require.NoError(t, job.Concurrency.Decode(&concurrency))
				case yaml.ScalarNode:
					concurrency.Group = job.Concurrency.Value
				}
				if id == deploy {
					require.Equal(t, "pulumi_deploy", concurrency.Group)
					require.Equal(t, "max", concurrency.Queue)
				} else {
					require.NotEqual(t, "pulumi_deploy", concurrency.Group)
				}
			}
		}
		if name == "staging" {
			var permissions map[string]string
			job := workflow.Jobs["CandidateBundle"]
			require.NoError(t, job.Permissions.Decode(&permissions))
			require.Equal(t, map[string]string{"actions": "read"}, permissions)
		}
	}
	require.Equal(t, []string{"staging"}, providers["merge_group"])
	require.Equal(t, []string{"staging-pr"}, providers["pull_request"])
}
