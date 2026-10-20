package selenium_test

import (
	"net/url"
	"strings"
	"testing"
	"time"

	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestConsoleLogWhileRendererBusy(t *testing.T) {
	driver, err := seleniumutil.NewWithChromeCapabilities(map[string]interface{}{"goog:loggingPrefs": map[string]string{"browser": "ALL"}})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	console, err := driver.WatchConsole()
	if err != nil {
		t.Fatal(err)
	}
	defer console.Close()
	// The page records its state before a long synchronous task. Reading that
	// record must not wait for another script to run in the occupied renderer.
	page := `<script>setTimeout(() => {
 console.log('renderer-busy-start');
 const until = Date.now() + 2000;
 while (Date.now() < until) {}
 console.log('renderer-busy-end');
 }, 300);</script>`
	if err := driver.Get("data:text/html," + url.PathEscape(page)); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	observedBusy := false
	for time.Now().Before(deadline) {
		text, err := console.Text()
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(text, "renderer-busy-start") && !strings.Contains(text, "renderer-busy-end") {
			observedBusy = true
		}
		if strings.Contains(text, "renderer-busy-end") {
			if !observedBusy {
				t.Fatal("console observation waited until the renderer finished its synchronous task")
			}
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("missing console events from the busy renderer")
}
