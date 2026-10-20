package selenium_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/tebeka/selenium"

	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
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
	driver, err := seleniumutil.New()
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

// Excluding ChromeDriver's timer override must retain the managed binary and
// normal launch arguments. Inspect Chromium's own runtime command line.
func TestChromeOptions(t *testing.T) {
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{
		"goog:chromeOptions": map[string]any{
			"excludeSwitches": []string{"disable-background-timer-throttling"},
		},
	}, "--window-size=900,700")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { driver.Close() })
	if err := driver.Get("chrome://version"); err != nil {
		t.Fatal(err)
	}
	commandLine, err := driver.FindElement(selenium.ByCSSSelector, "#command_line")
	if err != nil {
		t.Fatal(err)
	}
	text, err := commandLine.Text()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(text, "--disable-background-timer-throttling") {
		t.Fatalf("excluded timer override remains active: %s", text)
	}
	if !strings.Contains(text, "--headless") || !strings.Contains(text, "--window-size=900,700") {
		t.Fatalf("normal launch arguments lost when adding Chrome options: %s", text)
	}
}
