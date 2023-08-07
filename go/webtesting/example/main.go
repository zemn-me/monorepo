// Should do a basic rules_webtesting test.
package main

import (
	"testing"

	"github.com/bazelbuild/rules_webtesting/go/webtest"
	"github.com/tebeka/selenium"
)

func TestWebApp(t *testing.T) {
	wd, err := webtest.NewWebDriverSession(selenium.Capabilities{})
	if err != nil {
		t.Fatal(err)
	}

	if err = wd.Get("data:text/html,<!DOCTYPE HTML><title>Something!</title><body>hello, world!</body>"); err != nil {
		t.Fatal(err)
	}

	title, err := wd.ExecuteScript("document.title", nil)

	if err != nil {
		t.Fatal(err)
	}

	const expectedTitle = "Something!"

	if title.(string) != "Something!" {
		t.Fatalf("Incorrect title: %+q (should be %+q)", title, expectedTitle)
	}

	const expectedBody = "hello, world!"

	body, err := wd.ExecuteScript(`document.body.textContent`, nil)

	if err != nil {
		t.Fatal(err)
	}

	if body.(string) != "hello, world!" {
		t.Fatalf("Incorrect body: %+q (should be %+q)", body, expectedBody)
	}

	// your test here

	if err := wd.Quit(); err != nil {
		t.Logf("Error quitting webdriver: %v", err)
	}
}
