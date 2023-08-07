// Should do a basic rules_webtesting test.
package example

import (
	"os"
	"testing"

	"github.com/bazelbuild/rules_webtesting/go/webtest"
	"github.com/tebeka/selenium"
)

func TestWebApp(t *testing.T) {
	if os.Getenv("WEB_TEST_WEBDRIVER_SERVER") == "" {
		// we're almost certainly being run as a regular test. just pass it.
		// gazelle can't really be reasonably stopped generating a helpful test stub.
		// so we just pass the test.
		t.Skip("Skipping test because we're not running under the webtest runner.")
	}

	wd, err := webtest.NewWebDriverSession(selenium.Capabilities{})
	if err != nil {
		t.Fatal(err)
	}

	defer wd.Quit()

	if err = wd.Get("data:text/html,<!DOCTYPE HTML><title>Something!</title><body>hello, world!</body>"); err != nil {
		t.Fatal(err)
	}

	title, err := wd.Title()
	if err != nil {
		t.Fatal(err)
	}

	const expectedTitle = "Something!"

	if title != "Something!" {
		t.Fatalf("Incorrect title: %+q (should be %+q)", title, expectedTitle)
	}

	const expectedBody = "hello, world!"

	body, err := wd.FindElement(selenium.ByCSSSelector, "body")

	if err != nil {
		t.Fatal(err)
	}

	bodyText, err := body.Text()

	if err != nil {
		t.Fatal(err)
	}

	if bodyText != "hello, world!" {
		t.Fatalf("Incorrect body: %+q (should be %+q)", body, expectedBody)
	}

	if err := wd.Quit(); err != nil {
		t.Logf("Error quitting webdriver: %v", err)
	}
}
