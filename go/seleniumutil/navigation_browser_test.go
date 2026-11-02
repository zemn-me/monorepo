package selenium_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestNavigationWaitsForAsyncScript(t *testing.T) {
	var pages atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Header().Set("Content-Type", "text/html")
			pages.Add(1)
			fmt.Fprint(w, `<output>loading</output><script>fetch("/poll")</script><script async src="/delayed.js"></script>`)
		case "/poll":
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusOK)
			w.(http.Flusher).Flush()
			<-r.Context().Done()
		case "/delayed.js":
			time.Sleep(500 * time.Millisecond)
			w.Header().Set("Content-Type", "text/javascript")
			fmt.Fprint(w, `document.querySelector('output').textContent='ready'`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{"pageLoadStrategy": "eager"})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if _, err := seleniumutil.NewVirtualClock(driver); err != nil {
		t.Fatal(err)
	}
	if err := driver.GetWithNetworkRetry(server.URL); err != nil {
		t.Fatal(err)
	}
	output, err := driver.FindElement(selenium.ByCSSSelector, "output")
	if err != nil {
		t.Fatal(err)
	}
	text, err := output.Text()
	if err != nil || text != "ready" {
		t.Fatalf("async script was not loaded: %q %v", text, err)
	}
	if pages.Load() != 1 {
		t.Fatalf("successful navigation reloaded %d times", pages.Load())
	}
}

func TestNavigationPreservesHTTPFailure(t *testing.T) {
	var pages atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			pages.Add(1)
		}
		http.Error(w, "deliberate server failure", http.StatusServiceUnavailable)
	}))
	defer server.Close()
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.GetWithNetworkRetry(server.URL); err != nil {
		t.Fatal(err)
	}
	body, err := driver.FindElement(selenium.ByCSSSelector, "body")
	if err != nil {
		t.Fatal(err)
	}
	text, err := body.Text()
	if err != nil || text != "deliberate server failure" {
		t.Fatalf("failure was hidden: %q %v", text, err)
	}
	if pages.Load() != 1 {
		t.Fatalf("HTTP failure triggered %d page requests", pages.Load())
	}
}
