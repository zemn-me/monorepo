// The workflow's command-line dependencies invoke this test binary in fixture
// mode. Only the build, deployment and external service boundaries are replaced.
package workflows_test

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

const marker = "test-only-cache-credential"
const queueBranch = "gh-readonly-queue/main/pr-1"

var archives = []string{"layers_bundle.tar.gz", "runfile_aliases.tar"}
var packaging = []string{"bundle.bzl", "bundle_test.sh", "deploy_failure_test.sh", "run.sh"}

type buildRecord struct {
	Args      []string
	Config    string
	HasConfig bool
	Workspace string
	BuildFile string
	Packaging []string
}

func TestMain(m *testing.M) {
	if filepath.Base(os.Args[0]) == "node" {
		if err := nodeAction(os.Args[1:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if len(os.Args) >= 3 && os.Args[1] == "--service" {
		if err := service(os.Args[2], os.Args[3:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	os.Exit(m.Run())
}

// act resolves Node once, then invokes the entrypoint from the upstream
// action.yml with INPUT_* variables and GitHub's output and state files.
func nodeAction(args []string) error {
	if slices.Equal(args, []string{"--no-warnings", "-e", "console.log(process.execPath)"}) {
		fmt.Println(os.Args[0])
		return nil
	}
	if len(args) != 1 {
		return fmt.Errorf("unexpected node invocation: %q", args)
	}
	if info, err := os.Stat(args[0]); err != nil || !info.Mode().IsRegular() {
		return fmt.Errorf("missing action entrypoint %s", args[0])
	}
	if os.Getenv("STATE_fixture_main_ran") == "true" {
		return nil // Post-action cleanup of the fixture services.
	}
	if err := appendLine(os.Getenv("GITHUB_STATE"), "fixture_main_ran=true"); err != nil {
		return err
	}
	repo := os.Getenv("GITHUB_ACTION_REPOSITORY")
	if os.Getenv("GITHUB_JOB") == "Submit" {
		if err := appendLine(os.Getenv("FIXTURE_SUBMIT_ACTIONS"), repo); err != nil {
			return err
		}
	}
	switch repo {
	case "actions/checkout":
		dest := os.Getenv("INPUT_PATH")
		if dest == "" {
			dest = "."
		}
		if !filepath.IsLocal(dest) {
			return fmt.Errorf("invalid checkout path %q", dest)
		}
		ref := os.Getenv("INPUT_REF")
		if ref == "" {
			ref = os.Getenv("GITHUB_SHA")
		}
		if err := os.MkdirAll(dest, 0755); err != nil {
			return err
		}
		for _, args := range [][]string{
			{"init", "-q"},
			{"fetch", "-q", "--depth=1", "--", os.Getenv("FIXTURE_REPO"), ref},
			{"checkout", "-q", "--detach", "FETCH_HEAD"},
		} {
			cmd := exec.Command("git", args...)
			cmd.Dir = dest
			if output, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("checkout %q: %w: %s", ref, err, output)
			}
		}
		return nil
	case "google-github-actions/get-secretmanager-secrets":
		if os.Getenv("CACHE_SECRET") == "missing" {
			return fmt.Errorf("fixture cache key unavailable")
		}
		for line := range strings.SplitSeq(os.Getenv("INPUT_SECRETS"), "\n") {
			alias, _, _ := strings.Cut(line, ":")
			switch alias {
			case "buildbuddy_api_key":
				if err := appendLine(os.Getenv("GITHUB_OUTPUT"), "buildbuddy_api_key="+marker); err != nil {
					return err
				}
			case "readonly_buildbuddy_api_key":
				if err := appendLine(os.Getenv("GITHUB_OUTPUT"), "readonly_buildbuddy_api_key="+marker); err != nil {
					return err
				}
			}
		}
		return nil
	case "actions/upload-artifact":
		dest := artifact(os.Getenv("GITHUB_RUN_ID"), os.Getenv("INPUT_NAME"))
		for path := range strings.SplitSeq(strings.TrimSpace(os.Getenv("INPUT_PATH")), "\n") {
			data, err := os.ReadFile(path)
			if os.IsNotExist(err) && os.Getenv("INPUT_IF-NO-FILES-FOUND") == "ignore" {
				continue
			}
			if err != nil {
				return err
			}
			if err := writeFile(filepath.Join(dest, filepath.Base(path)), string(data), 0644); err != nil {
				return err
			}
		}
		return nil
	case "actions/download-artifact":
		run := os.Getenv("GITHUB_RUN_ID")
		if id := os.Getenv("INPUT_RUN-ID"); os.Getenv("INPUT_GITHUB-TOKEN") != "" && id != "" {
			run = id
		}
		name := os.Getenv("INPUT_NAME")
		if err := os.CopyFS(os.Getenv("INPUT_PATH"), os.DirFS(artifact(run, name))); err != nil {
			return fmt.Errorf("download %q from run %s: %w", name, run, err)
		}
		return nil
	case "google-github-actions/auth", "aws-actions/configure-aws-credentials":
		return nil
	default:
		return fmt.Errorf("no Node service fixture for %s", repo)
	}
}

func writeFile(path, value string, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(value), mode)
}

func appendLine(path, value string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(f, value)
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	return err
}

func artifact(run, name string) string { return filepath.Join(os.Getenv("FIXTURE_STORE"), run, name) }

func github(args []string) error {
	if len(args) >= 2 && slices.Equal(args[:2], []string{"run", "list"}) {
		for flag, value := range map[string]string{
			"--repo": "owner/repo", "--workflow": "presubmit.yml", "--event": "merge_group",
			"--commit": os.Getenv("FIXTURE_SHA"), "--branch": queueBranch,
		} {
			i := slices.Index(args, flag)
			if i < 0 || i+1 >= len(args) || args[i+1] != value {
				return fmt.Errorf("unexpected run lookup: %v", args)
			}
		}
		// The producer first appears, starts running, then finishes.
		state := filepath.Join(os.Getenv("RUNNER_TEMP"), "lookups")
		seen, err := os.ReadFile(state)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		switch len(seen) {
		case 0:
		case 1:
			fmt.Println("42\t3\tin_progress\t")
		default:
			fmt.Println("42\t3\tcompleted\t" + os.Getenv("PRODUCER_RESULT"))
		}
		return writeFile(state, string(seen)+".", 0600)
	}
	for _, arg := range args {
		switch {
		case strings.HasSuffix(arg, "/git/ref/heads/main"):
			if os.Getenv("MAIN_SHA") == "api-error" {
				return fmt.Errorf("fixture main lookup failed")
			}
			fmt.Println(os.Getenv("MAIN_SHA"))
			return nil
		case strings.HasSuffix(arg, "/actions/workflows/submit.yml/runs"):
			fmt.Println(`{"workflow_runs":[{"id":11}]}`)
			return nil
		case strings.HasSuffix(arg, "/actions/runs/11/artifacts"):
			files, err := filepath.Glob(artifact("11", "*"))
			if err != nil {
				return err
			}
			rows := make([]map[string]any, 0, len(files))
			for _, p := range files {
				rows = append(rows, map[string]any{"name": filepath.Base(p), "expired": false})
			}
			return json.NewEncoder(os.Stdout).Encode(map[string]any{"artifacts": rows})
		}
	}
	return fmt.Errorf("unhandled GitHub request: %v", args)
}

func writeArchives(dir, revision string) error {
	for _, name := range archives {
		if err := writeFile(filepath.Join(dir, name), revision, 0644); err != nil {
			return err
		}
	}
	return nil
}

func bazel(args []string) error {
	switch args[0] {
	case "info":
		dir, err := filepath.Abs("dist")
		if err != nil {
			return err
		}
		fmt.Println(dir)
		return nil
	case "run":
		separator := slices.Index(args, "--")
		if separator < 0 || !slices.Contains(args[:separator], "//ci:presubmit") || !slices.Contains(args[separator+1:], "--skip-pulumi-deploy") {
			return fmt.Errorf("expected a presubmit run with deployment disabled, got %q", args)
		}
		if os.Getenv("FAIL_PRESUBMIT") == "true" {
			return fmt.Errorf("fixture presubmit failed")
		}
		if os.Getenv("GITHUB_EVENT_NAME") == "merge_group" {
			return writeArchives("dist/candidate-bin/ci/deploy", os.Getenv("GITHUB_SHA"))
		}
		return nil
	case "build", "test":
		config, err := os.ReadFile(".auth.bazelrc")
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		r := buildRecord{Args: args, Config: string(config), HasConfig: err == nil, Workspace: os.Getenv("GITHUB_WORKSPACE")}
		if args[0] == "test" {
			program, err := os.ReadFile("ci/deploy/deploy.ts")
			if err != nil {
				return err
			}
			if err := writeArchives("dist/bin/ci/deploy", string(program)); err != nil {
				return err
			}
			build, err := os.ReadFile("ci/deploy/BUILD.bazel")
			if err != nil {
				return err
			}
			r.BuildFile = string(build)
			for _, name := range packaging {
				data, err := os.ReadFile(filepath.Join("ci/deploy", name))
				if err != nil {
					return err
				}
				r.Packaging = append(r.Packaging, string(data))
			}
		}
		data, err := json.Marshal(r)
		if err != nil {
			return err
		}
		return os.WriteFile(os.Getenv("FIXTURE_BUILD"), data, 0600)
	}
	return fmt.Errorf("unhandled Bazel invocation: %v", args)
}

func service(name string, args []string) error {
	switch name {
	case "gh":
		return github(args)
	case "bazel":
		return bazel(args)
	case "deploy":
		if args[1] != "ci/deploy/deploy" {
			return fmt.Errorf("unexpected launcher %s", args[1])
		}
		var revision string
		for i, name := range archives {
			data, err := os.ReadFile(filepath.Join(args[0], name))
			if err != nil {
				return err
			}
			if i > 0 && revision != string(data) {
				return fmt.Errorf("mismatched deployment archives")
			}
			revision = string(data)
		}
		if err := appendLine(os.Getenv("FIXTURE_DEPLOYMENTS"), args[2]+" "+revision); err != nil {
			return err
		}
		if args[2] == os.Getenv("FAIL_DEPLOY") {
			return fmt.Errorf("fixture deployment failed")
		}
		return nil
	}
	return fmt.Errorf("unknown service %s", name)
}
