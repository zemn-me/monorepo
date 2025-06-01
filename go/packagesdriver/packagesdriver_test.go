package packagesdriver

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"golang.org/x/tools/go/packages"
)

// addShBin amends PATH with <workspace>/sh/bin (outside the sandbox).
func addShBin(t testing.TB) {
	t.Helper()

	shbin := filepath.Join(root, "sh", "bin")

	old := os.Getenv("PATH")
	t.Setenv("PATH", fmt.Sprintf("%s%c%s", shbin, os.PathListSeparator, old))

	fmt.Println("newenv PATH:", os.Getenv("PATH"))
}

// locateDriver resolves the driver’s absolute path or fatals.
func locateDriver(t testing.TB) string {
	t.Helper()

	driverRel := os.Getenv("GOPACKAGESBINARY")
	rfs, err := runfiles.New()
	if err != nil {
		t.Fatalf("runfiles.New: %v", err)
	}
	drv, err := rfs.Rlocation(driverRel)
	if err != nil {
		t.Fatalf("Rlocation: %v", err)
	}
	abs, err := filepath.Abs(drv)
	if err != nil {
		t.Fatalf("abs: %v", err)
	}
	if _, err := os.Stat(abs); err != nil {
		t.Fatalf("stat %s: %v", abs, err)
	}
	return abs
}

func TestProbeDriverBuiltin(t *testing.T) {
	addShBin(t)
	drv := locateDriver(t)

	cmd := exec.CommandContext(t.Context(), drv, "builtin")
	cmd.Stdin = bytes.NewBufferString("{}")

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("probe failed: %v\n%s", err, out)
	}
	if err := json.Unmarshal(out, new(interface{})); err != nil {
		t.Fatalf("invalid JSON: %v\n%s", err, out)
	}
}

func TestSmokeGOPACKAGESDRIVER(t *testing.T) {
	addShBin(t)
	drv := locateDriver(t)
	t.Setenv("GOPACKAGESDRIVER", drv)

	cfg := &packages.Config{
		Mode:    packages.NeedName | packages.NeedCompiledGoFiles | packages.NeedDeps,
		Context: t.Context(),
		Env:     append(os.Environ(), "GOPACKAGESDEBUG=true"),
		Logf:    t.Logf,
	}
	pkgs, err := packages.Load(cfg, "builtin")
	if err != nil {
		t.Fatalf("packages.Load: %v", err)
	}
	if packages.PrintErrors(pkgs) > 0 {
		t.Fatalf("driver returned package errors")
	}
}
