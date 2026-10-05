package selenium_test

import (
	"testing"

	selenium "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestBrowserSession(t *testing.T) {
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
