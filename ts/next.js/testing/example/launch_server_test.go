package example

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"testing"

	"github.com/bazelbuild/rules_go/go/runfiles"
)

var reLocalhost = regexp.MustCompile(`https?://localhost:\d+`)

func TestLaunchDevServer(t *testing.T) {
	absPath, err := runfiles.Rlocation(
		os.Getenv("NEXT_SERVER_BINARY"),
	)
	if err != nil {
		t.Fatalf("could not find server binary: %v", err)
	}

	cmd := exec.Command(absPath)

	// ---- capture output ----------------------------------------------------
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout pipe: %v", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		t.Fatalf("stderr pipe: %v", err)
	}

	var stderr bytes.Buffer
	go io.Copy(&stderr, stderrPipe) // drain stderr in the background

	if err := cmd.Start(); err != nil {
		t.Fatalf("start server: %v", err)
	}
	defer cmd.Process.Kill()

	// ---- discover address --------------------------------------------------
	rd := bufio.NewReader(stdout)
	var addr string
	for {
		line, err := rd.ReadString('\n')
		if err != nil {
			t.Fatalf("reading server output: %v\n--- stderr ---\n%s", err, stderr.String())
		}
		if m := reLocalhost.FindString(line); m != "" {
			addr = m
			break
		}
	}

	// ---- basic health‑check ------------------------------------------------
	resp, err := http.Get(addr)
	if err != nil {
		t.Fatalf("GET %s: %v\n--- stderr ---\n%s", addr, err, stderr.String())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d\n--- stderr ---\n%s", resp.StatusCode, stderr.String())
	}
}

func TestLaunchProdServer(t *testing.T) {
	absPath, err := runfiles.Rlocation(
		os.Getenv("NEXT_PROD_SERVER_BINARY"),
	)
	if err != nil {
		t.Fatalf("could not find server binary: %v", err)
	}

	cmd := exec.Command(absPath)

	// ---- capture output ----------------------------------------------------
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout pipe: %v", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		t.Fatalf("stderr pipe: %v", err)
	}

	var stderr bytes.Buffer
	go io.Copy(&stderr, stderrPipe) // drain stderr in the background

	if err := cmd.Start(); err != nil {
		t.Fatalf("start server: %v", err)
	}
	defer cmd.Process.Kill()

	// ---- discover address --------------------------------------------------
	rd := bufio.NewReader(stdout)
	var addr string
	for {
		line, err := rd.ReadString('\n')
		if err != nil {
			t.Fatalf("reading server output: %v\n--- stderr ---\n%s", err, stderr.String())
		}
		if m := reLocalhost.FindString(line); m != "" {
			addr = m
			break
		}
	}

	// ---- basic health‑check ------------------------------------------------
	resp, err := http.Get(addr)
	if err != nil {
		t.Fatalf("GET %s: %v\n--- stderr ---\n%s", addr, err, stderr.String())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d\n--- stderr ---\n%s", resp.StatusCode, stderr.String())
	}
}
