package selenium_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	selenium "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestBrowserSession(t *testing.T) {
	if runtime.GOOS == "linux" {
		// Bazel's integration runner provides a TMPDIR longer than a Unix socket path.
		tmp := filepath.Join(t.TempDir(), strings.Repeat("temporary-", 20))
		if err := os.MkdirAll(tmp, 0755); err != nil {
			t.Fatal(err)
		}
		t.Setenv("TMPDIR", tmp)
	}
	driver, err := selenium.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.Get("data:text/html,<title>browser smoke test</title>"); err != nil {
		t.Fatal(err)
	}
	title, err := driver.Title()
	if err != nil {
		t.Fatal(err)
	}
	if title != "browser smoke test" {
		t.Fatalf("title = %q", title)
	}
}
