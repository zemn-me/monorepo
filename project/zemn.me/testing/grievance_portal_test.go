package selenium_test

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestGrievancePortalHasNoErrors(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}

	portal := root
	portal.Path = "/grievanceportal"

	testEndpointHasNoLogErrors(t, portal.String())
}

func TestGrievancePortalEndToEnd(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	ports, err := servicePorts()
	if err != nil {
		t.Fatalf("could not parse service ports: %v", err)
	}

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	portalURL := root
	portalURL.Path = "/grievanceportal"

	if err := driver.Get(portalURL.String()); err != nil {
		t.Fatalf("navigate grievance portal: %v", err)
	}

	expectedIssuer := ""
	if ports.OIDCProvider != "" {
		expectedIssuer = "http://localhost:" + ports.OIDCProvider
	} else if envIssuer := os.Getenv("ZEMN_TEST_OIDC_ISSUER"); envIssuer != "" {
		expectedIssuer = envIssuer
	} else {
		expectedIssuer = "http://localhost:43111"
	}
	if hostVal, err := driver.ExecuteScript("return window.location.hostname;", nil); err == nil {
		t.Logf("grievance portal hostname: %v", hostVal)
	}
	if _, err := waitForRequestURLFromButton(driver, expectedIssuer, 20*time.Second); err != nil {
		t.Fatalf("oidc request url: %v", err)
	}

	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatalf("oidc login: %v", err)
	}

	if err := waitForText(driver, "You are logged in.", 30*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("wait for login text: %v (body snippet: %v)", err, body)
	}

	grievanceName := fmt.Sprintf("Integration grievance %d", time.Now().UnixNano())
	grievanceDescription := "integration test grievance description"

	nameInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[name='name']", 10*time.Second)
	if err != nil {
		t.Fatalf("grievance name input: %v", err)
	}
	if err := nameInput.Clear(); err != nil {
		t.Fatalf("clear grievance name: %v", err)
	}
	if err := nameInput.SendKeys(grievanceName); err != nil {
		t.Fatalf("fill grievance name: %v", err)
	}

	descriptionInput, err := waitForElement(driver, selenium.ByCSSSelector, "textarea[name='description']", 10*time.Second)
	if err != nil {
		t.Fatalf("grievance description textarea: %v", err)
	}
	if err := descriptionInput.Clear(); err != nil {
		t.Fatalf("clear grievance description: %v", err)
	}
	if err := descriptionInput.SendKeys(grievanceDescription); err != nil {
		t.Fatalf("fill grievance description: %v", err)
	}

	submit, err := waitForElement(driver, selenium.ByCSSSelector, "form input[type='submit']", 10*time.Second)
	if err != nil {
		t.Fatalf("submit button: %v", err)
	}
	if err := submit.Click(); err != nil {
		t.Fatalf("submit grievance form: %v", err)
	}

	entryXPath := fmt.Sprintf("//li[.//strong[normalize-space()='%s']]", grievanceName)
	entry, err := waitForElement(driver, selenium.ByXPATH, entryXPath, 30*time.Second)
	if err != nil {
		t.Fatalf("wait for grievance entry: %v", err)
	}

	descriptionNode, err := entry.FindElement(selenium.ByXPATH, ".//pre")
	if err != nil {
		t.Fatalf("grievance description node: %v", err)
	}
	if text, err := descriptionNode.Text(); err != nil {
		t.Fatalf("read grievance description: %v", err)
	} else if strings.TrimSpace(text) != grievanceDescription {
		t.Fatalf("unexpected grievance description %q", text)
	}

	deleteButton, err := entry.FindElement(selenium.ByXPATH, ".//button[contains(normalize-space(.), 'Delete')]")
	if err != nil {
		t.Fatalf("delete button: %v", err)
	}
	if err := deleteButton.Click(); err != nil {
		t.Fatalf("click delete button: %v", err)
	}

	if err := waitForNoElement(driver, selenium.ByXPATH, entryXPath, 30*time.Second); err != nil {
		t.Fatalf("grievance entry was not removed: %v", err)
	}
}
