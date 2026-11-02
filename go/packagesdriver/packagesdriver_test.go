package packagesdriver_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"golang.org/x/tools/go/packages"
)

const builtinID = "@io_bazel_rules_go//stdlib:builtin"

// Exercise the real driver against isolated Bazel protocol fixtures. Running a
// nested workspace build here would depend on the host PATH and network/cache
// state instead of the declared driver binary and these test inputs.
func TestMain(m *testing.M) {
	if dir := os.Getenv("PACKAGESDRIVER_FIXTURE"); dir != "" {
		if err := serveBazelFixture(dir, os.Args[1:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func serveBazelFixture(dir string, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("missing Bazel command")
	}
	switch args[0] {
	case "info":
		fmt.Printf("execution_root: %s\noutput_base: %s\noutput_path: %s\n", dir, dir, dir)
	case "query":
		label := args[len(args)-1]
		if !strings.HasPrefix(label, "@") || !strings.HasSuffix(label, "//:stdlib") || strings.ContainsAny(label, " \t\n") {
			return fmt.Errorf("unexpected query: %q", args)
		}
		// Preserve the canonical repository name selected by the real driver.
		fmt.Println(label)
	case "build":
		if !slices.ContainsFunc(args, func(arg string) bool {
			return strings.HasPrefix(arg, "@") && strings.HasSuffix(arg, "//:stdlib")
		}) {
			return fmt.Errorf("missing stdlib build target: %q", args)
		}
		for _, arg := range args {
			if path, ok := strings.CutPrefix(arg, "--build_event_json_file="); ok {
				uri := (&url.URL{Scheme: "file", Path: filepath.Join(dir, "builtin.pkg.json")}).String()
				bep, err := json.Marshal(map[string]any{"namedSetOfFiles": map[string]any{"files": []map[string]string{{"name": "builtin.pkg.json", "uri": uri}}}})
				if err != nil {
					return err
				}
				return os.WriteFile(path, bep, 0600)
			}
		}
		return fmt.Errorf("missing build event output: %q", args)
	default:
		return fmt.Errorf("unexpected Bazel command: %q", args)
	}
	return nil
}

func setupDriver(t *testing.T) (driver, dir string) {
	t.Helper()
	rf, err := runfiles.New()
	if err != nil {
		t.Fatal(err)
	}
	driver, err = rf.Rlocation(os.Getenv("GOPACKAGESBINARY"))
	if err != nil {
		t.Fatal(err)
	}
	driver, err = filepath.Abs(driver)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(driver); err != nil {
		t.Fatal(err)
	}
	fixture, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	dir = t.TempDir()
	for name, content := range map[string]string{
		"go.mod":           "module example.com/driverfixture\n\ngo 1.23\n",
		"builtin.go":       "package builtin\n",
		"builtin.pkg.json": `{"ID":"` + builtinID + `","Name":"builtin","PkgPath":"builtin","Standard":true,"GoFiles":["__BAZEL_WORKSPACE__/builtin.go"]}`,
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PACKAGESDRIVER_FIXTURE", dir)
	t.Setenv("GOPACKAGESDRIVER_BAZEL", fixture)
	t.Setenv("BUILD_WORKSPACE_DIRECTORY", dir)
	t.Setenv("BUILD_WORKING_DIRECTORY", dir)
	for _, key := range []string{"GOPACKAGESDRIVER_BAZEL_FLAGS", "GOPACKAGESDRIVER_BAZEL_COMMON_FLAGS", "GOPACKAGESDRIVER_BAZEL_QUERY_FLAGS", "GOPACKAGESDRIVER_BAZEL_QUERY_SCOPE", "GOPACKAGESDRIVER_BAZEL_BUILD_FLAGS", "GOPACKAGESDRIVER_BAZEL_ADDTL_ASPECTS", "GOPACKAGESDRIVER_BAZEL_KINDS", "GOPACKAGESDRIVER_LOG"} {
		t.Setenv(key, "")
	}
	return driver, dir
}

func TestProbeDriverBuiltin(t *testing.T) {
	driver, dir := setupDriver(t)
	cmd := exec.CommandContext(t.Context(), driver, "builtin")
	cmd.Dir = dir
	cmd.Stdin = strings.NewReader(`{}`)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("driver: %v\n%s", err, &stderr)
	}
	var response packages.DriverResponse
	if err := json.Unmarshal(out, &response); err != nil {
		t.Fatalf("invalid driver JSON: %v\nstdout: %s\nstderr: %s", err, out, &stderr)
	}
	if response.NotHandled || !slices.Equal(response.Roots, []string{builtinID}) {
		t.Fatalf("unexpected driver response: %+v", response)
	}
	assertBuiltin(t, response.Packages, dir)
}

func TestSmokeGOPACKAGESDRIVER(t *testing.T) {
	driver, dir := setupDriver(t)
	t.Setenv("GOPACKAGESDRIVER", driver)
	pkgs, err := packages.Load(&packages.Config{
		Mode:    packages.NeedName | packages.NeedCompiledGoFiles | packages.NeedDeps,
		Context: t.Context(),
		Dir:     dir,
		Env:     os.Environ(),
		Logf:    t.Logf,
	}, "builtin")
	if err != nil {
		t.Fatal(err)
	}
	if n := packages.PrintErrors(pkgs); n != 0 {
		t.Fatalf("%d package errors", n)
	}
	assertBuiltin(t, pkgs, dir)
}

func assertBuiltin(t *testing.T, pkgs []*packages.Package, dir string) {
	t.Helper()
	if len(pkgs) != 1 {
		t.Fatalf("expected one builtin package, got %d", len(pkgs))
	}
	p := pkgs[0]
	if p.ID != builtinID || p.Name != "builtin" || p.PkgPath != "builtin" || len(p.Errors) != 0 {
		t.Fatalf("unexpected builtin package: %+v", p)
	}
	if !slices.Equal(p.CompiledGoFiles, []string{filepath.Join(dir, "builtin.go")}) {
		t.Fatalf("unexpected compiled files: %q", p.CompiledGoFiles)
	}
}
