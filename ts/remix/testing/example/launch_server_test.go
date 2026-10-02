package example

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestPrerenderHydrationAndNavigation(t *testing.T) {
	var ports struct {
		Development string `json:"@@//ts/remix/testing/example:dev_service"`
		Production  string `json:"@@//ts/remix/testing/example:production_service"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		t.Fatal(err)
	}
	port := ports.Development
	if port == "" {
		port = ports.Production
	}
	if port == "" {
		t.Fatal("no assigned server port")
	}
	root := fmt.Sprintf("http://localhost:%s", port)
	for route, title := range map[string]string{"/": "Home | Example", "/about": "About | Example"} {
		response, err := http.Get(root + route)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != http.StatusOK || !strings.Contains(string(body), "<title>"+title+"</title>") {
			t.Fatalf("%s: expected prerendered title %q, got status %d: %s", route, title, response.StatusCode, body)
		}
	}
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.Get(root); err != nil {
		t.Fatal(err)
	}
	button, err := driver.FindElement(selenium.ByCSSSelector, "button")
	if err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		if err := button.Click(); err != nil {
			return false, err
		}
		label, err := button.Text()
		return label != "Count: 0", err
	}, 20*time.Second); err != nil {
		t.Fatalf("hydration: %v", err)
	}
	note, err := driver.FindElement(selenium.ByCSSSelector, "input[name=note]")
	if err != nil {
		t.Fatal(err)
	}
	if err := note.SendKeys("Keep this across navigation"); err != nil {
		t.Fatal(err)
	}
	// The document time origin remains stable across client navigation.
	origin, err := driver.ExecuteScript("return performance.timeOrigin", nil)
	if err != nil {
		t.Fatal(err)
	}
	link, err := driver.FindElement(selenium.ByLinkText, "About")
	if err != nil {
		t.Fatal(err)
	}
	if err := link.Click(); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		title, err := wd.Title()
		return title == "About | Example", err
	}, 20*time.Second); err != nil {
		t.Fatal(err)
	}
	message, err := driver.FindElement(selenium.ByCSSSelector, "main p")
	if err != nil {
		t.Fatal(err)
	}
	if text, err := message.Text(); err != nil || text != "Prerendered loader data" {
		t.Fatalf("client navigation did not load prerendered data: %q, %v", text, err)
	}
	after, err := driver.ExecuteScript("return performance.timeOrigin", nil)
	if err != nil {
		t.Fatal(err)
	}
	if origin != after {
		t.Fatal("internal navigation reloaded the document")
	}
	retained, err := driver.ExecuteScript("return document.querySelector('input[name=note]').value", nil)
	if err != nil || retained != "Keep this across navigation" {
		t.Fatalf("root layout did not persist: %v, %v", retained, err)
	}
	if err := driver.Back(); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		title, err := wd.Title()
		return title == "Home | Example", err
	}, 20*time.Second); err != nil {
		t.Fatal(err)
	}
}
