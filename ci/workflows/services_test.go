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
const candidateArtifactID = "456"
const dispatchedURL = "https://github.com/owner/repo/actions/runs/73"

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
		if name := os.Getenv("INPUT_NAME"); strings.HasPrefix(name, "staging-candidate-") {
			if err := writeFile(artifact(os.Getenv("GITHUB_RUN_ID"), candidateArtifactID), name, 0644); err != nil {
				return err
			}
			return appendLine(os.Getenv("GITHUB_OUTPUT"), "artifact-id="+candidateArtifactID)
		}
		return nil
	case "actions/download-artifact":
		run := os.Getenv("GITHUB_RUN_ID")
		if id := os.Getenv("INPUT_RUN-ID"); os.Getenv("INPUT_GITHUB-TOKEN") != "" && id != "" {
			run = id
		}
		name := os.Getenv("INPUT_NAME")
		if ids := os.Getenv("INPUT_ARTIFACT-IDS"); ids != "" {
			if name != "" || ids != candidateArtifactID {
				return fmt.Errorf("unexpected artifact selection: name %q, IDs %q", name, ids)
			}
			data, err := os.ReadFile(artifact(run, ids))
			if err != nil {
				return err
			}
			name = string(data)
		}
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
	form := map[string]string{}
	for i, arg := range args {
		if arg == "-f" && i+1 < len(args) {
			key, value, ok := strings.Cut(args[i+1], "=")
			if ok {
				form[key] = value
			}
		}
	}
	for _, arg := range args {
		switch {
		case arg == "repos/owner/repo/actions/workflows/staging.yml/dispatches":
			if !slices.Contains(args, "POST") || !slices.Contains(args, ".html_url") || form["ref"] != queueBranch || form["inputs[artifact-id]"] == "" {
				return fmt.Errorf("invalid workflow dispatch: %q", args)
			}
			if os.Getenv("FAIL_DISPATCH") == "true" {
				return fmt.Errorf("workflow dispatch rejected")
			}
			event, err := json.Marshal(map[string]any{
				"ref": "refs/heads/" + form["ref"], "inputs": map[string]string{"artifact-id": form["inputs[artifact-id]"]},
			})
			if err != nil {
				return err
			}
			fmt.Println(dispatchedURL)
			return writeFile(os.Getenv("FIXTURE_DISPATCH"), string(event), 0600)
		case arg == "repos/owner/repo/statuses/"+os.Getenv("FIXTURE_SHA"):
			if !slices.Contains(args, "POST") {
				return fmt.Errorf("expected a status POST: %q", args)
			}
			return appendLine(os.Getenv("FIXTURE_STATUSES"), strings.Join([]string{form["context"], form["state"], form["target_url"]}, " "))
		case arg == "repos/owner/repo/commits/"+os.Getenv("FIXTURE_SHA")+"/status":
			statuses, err := os.ReadFile(os.Getenv("FIXTURE_STATUSES"))
			if err != nil {
				return err
			}
			var owner string
			for line := range strings.SplitSeq(string(statuses), "\n") {
				fields := strings.Fields(line)
				if len(fields) == 3 && fields[0] == "Staging" {
					owner = fields[2]
				}
			}
			fmt.Println(owner)
			return nil
		case strings.HasSuffix(arg, "/actions/artifacts/"+candidateArtifactID):
			name, err := os.ReadFile(artifact("42", candidateArtifactID))
			if err != nil {
				return err
			}
			return json.NewEncoder(os.Stdout).Encode(map[string]any{
				"name": string(name), "expired": false, "workflow_run": map[string]int{"id": 42},
			})
		case strings.HasSuffix(arg, "/actions/runs/42/attempts/3"):
			return json.NewEncoder(os.Stdout).Encode(map[string]any{
				"event": "merge_group", "path": ".github/workflows/presubmit.yml", "run_attempt": 3,
				"head_branch": queueBranch, "head_sha": os.Getenv("FIXTURE_SHA"),
			})
		case strings.HasSuffix(arg, "/actions/runs/42/attempts/3/jobs"):
			return json.NewEncoder(os.Stdout).Encode(map[string]any{"jobs": []map[string]string{
				{"name": "Build candidate", "conclusion": os.Getenv("PRODUCER_RESULT")},
			}})
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
