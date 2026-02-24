package selenium_test

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

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
	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	loginToGrievancePortal(t, driver)

	grievanceDescription := fmt.Sprintf("integration test grievance %d", time.Now().UnixNano())
	entry, _ := submitGrievanceForm(t, driver, grievanceDescription)

	descriptionNode, err := entry.FindElement(selenium.ByXPATH, ".//pre")
	if err != nil {
		t.Fatalf("grievance description node: %v", err)
	}
	if text, err := descriptionNode.Text(); err != nil {
		t.Fatalf("read grievance description: %v", err)
	} else if strings.TrimSpace(text) != grievanceDescription {
		t.Fatalf("unexpected grievance description %q", text)
	}

}

func TestGrievancePortalDisplaysClientTimeZone(t *testing.T) {
	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	loginToGrievancePortal(t, driver)
	restore := forceGrievanceSubmissionTimeZone(t, driver, "Pacific/Honolulu")
	defer restore()

	description := fmt.Sprintf("verify timezone rendering %d", time.Now().UnixNano())
	entry, _ := submitGrievanceForm(t, driver, description)
	restore()
	restore = func() {}

	timeNode, err := entry.FindElement(selenium.ByCSSSelector, "time")
	if err != nil {
		t.Fatalf("time element: %v", err)
	}
	stamp, err := timeNode.Text()
	if err != nil {
		t.Fatalf("time text: %v", err)
	}
	if !strings.Contains(stamp, "Honolulu, Pacific") {
		t.Fatalf("grievance timestamp missing timezone label: %q", stamp)
	}

}

func TestGrievancePortalListUpdatesAfterCreate(t *testing.T) {
	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	loginToGrievancePortal(t, driver)
	initialCount, err := grievanceCount(driver)
	if err != nil {
		t.Fatalf("initial grievance count: %v", err)
	}

	description := fmt.Sprintf("list should update without refresh %d", time.Now().UnixNano())
	entry, _ := submitGrievanceForm(t, driver, description)

	if err := waitForGrievanceCount(driver, initialCount+1, 30*time.Second); err != nil {
		t.Fatalf("grievance list did not update: %v", err)
	}

	_ = entry
}

func loginToGrievancePortal(t *testing.T, driver selenium.WebDriver) {
	t.Helper()
	portalURL, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	portalURL.Path = "/grievanceportal"
	if err := driver.Get(portalURL.String()); err != nil {
		t.Fatalf("navigate grievance portal: %v", err)
	}
	if alreadyLoggedIn(driver) {
		return
	}

	if hostVal, err := driver.ExecuteScript("return window.location.hostname;", nil); err == nil {
		t.Logf("grievance portal hostname: %v", hostVal)
	}

	if _, err := waitForLoginButtonReady(driver, 20*time.Second); err != nil {
		if alreadyLoggedIn(driver) {
			return
		}
		t.Fatalf("oidc login readiness: %v", err)
	}

	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		if alreadyLoggedIn(driver) {
			return
		}
		t.Fatalf("oidc login: %v", err)
	}

	if err := waitForText(driver, "You are logged in.", 30*time.Second); err != nil {
		if alreadyLoggedIn(driver) {
			return
		}
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("wait for login text: %v (body snippet: %v)", err, body)
	}
}

func submitGrievanceForm(t *testing.T, driver selenium.WebDriver, description string) (selenium.WebElement, string) {
	t.Helper()
	if err := fillFieldWithRetry(driver, selenium.ByCSSSelector, "textarea[name='description']", description, 15*time.Second); err != nil {
		t.Fatalf("fill grievance description: %v", err)
	}
	if err := clickElementWithRetry(driver, selenium.ByCSSSelector, "form input[type='submit']", 10*time.Second); err != nil {
		t.Fatalf("submit grievance form: %v", err)
	}

	entryXPath := grievanceEntryXPath(description)
	entry, err := waitForGrievanceElement(driver, description, 60*time.Second)
	if err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("wait for grievance entry: %v", err)
	}
	return entry, entryXPath
}

func grievanceEntryXPath(description string) string {
	return fmt.Sprintf("//li[.//pre[normalize-space()='%s']]", description)
}

func forceGrievanceSubmissionTimeZone(t *testing.T, driver *seleniumpkg.Driver, zone string) (restore func()) {
	t.Helper()
	current := "UTC"
	if tz, err := driver.ExecuteScript("return Intl.DateTimeFormat().resolvedOptions().timeZone;", nil); err == nil {
		if s, ok := tz.(string); ok && s != "" {
			current = s
		}
	}
	if err := driver.SetTimezoneOverride(zone); err != nil {
		t.Fatalf("set timezone override: %v", err)
	}
	if tzNow, err := driver.ExecuteScript("return Intl.DateTimeFormat().resolvedOptions().timeZone;", nil); err == nil {
		if s, ok := tzNow.(string); !ok || s != zone {
			t.Fatalf("timezone override ineffective: got %v", tzNow)
		}
	}
	return func() {
		if err := driver.SetTimezoneOverride(current); err != nil {
			t.Logf("reset timezone override: %v", err)
		}
	}
}

func dumpPageDiagnostics(t *testing.T, driver selenium.WebDriver) {
	if body, err := driver.ExecuteScript("return document.body ? document.body.innerText : ''", nil); err == nil {
		if text, ok := body.(string); ok {
			if len(text) > 1024 {
				text = text[:1024]
			}
			t.Logf("page text snippet: %s", text)
		}
	}
	if html, err := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil); err == nil {
		if text, ok := html.(string); ok {
			if len(text) > 1024 {
				text = text[:1024]
			}
			t.Logf("page html snippet: %s", text)
		}
	}
	if count, err := driver.ExecuteScript("return document.querySelectorAll('li').length;", nil); err == nil {
		if n, ok := count.(float64); ok {
			t.Logf("li count: %d", int(n))
		}
	}
	if logs, err := driver.Log(log.Browser); err == nil {
		ignored := []string{
			"Failed to parse source map",
			"react-dev-overlay",
		}
		filtered := make([]log.Message, 0, len(logs))
	outer:
		for _, entry := range logs {
			for _, pattern := range ignored {
				if strings.Contains(entry.Message, pattern) {
					continue outer
				}
			}
			if entry.Level == log.Severe || strings.Contains(strings.ToLower(entry.Message), "error") {
				filtered = append(filtered, entry)
			}
		}
		max := 5
		if len(filtered) < max {
			max = len(filtered)
		}
		for i := 0; i < max; i++ {
			t.Logf("console[%d]: %s", i, filtered[i].Message)
		}
	}
}

func grievanceCount(driver selenium.WebDriver) (int, error) {
	count, err := driver.ExecuteScript("return document.querySelectorAll('ul li').length;", nil)
	if err != nil {
		return 0, err
	}
	v, ok := count.(float64)
	if !ok {
		return 0, fmt.Errorf("unexpected count type %T", count)
	}
	return int(v), nil
}

func waitForGrievanceCount(driver selenium.WebDriver, want int, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		n, err := grievanceCount(wd)
		if err != nil {
			return false, nil
		}
		return n >= want, nil
	}, timeout)
}

func alreadyLoggedIn(driver selenium.WebDriver) bool {
	if _, err := driver.FindElement(selenium.ByXPATH, "//*[contains(text(),'You are logged in.')]"); err == nil {
		return true
	}
	return false
}

func fillFieldWithRetry(driver selenium.WebDriver, by, selector, text string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		elem, err := driver.FindElement(by, selector)
		if err != nil {
			lastErr = err
			time.Sleep(200 * time.Millisecond)
			continue
		}
		if err := elem.Clear(); err != nil {
			lastErr = err
			if isStaleElementErr(err) {
				time.Sleep(150 * time.Millisecond)
				continue
			}
			return fmt.Errorf("clear %s:%s: %w", by, selector, err)
		}
		if err := elem.SendKeys(text); err != nil {
			lastErr = err
			if isStaleElementErr(err) {
				time.Sleep(150 * time.Millisecond)
				continue
			}
			return fmt.Errorf("send keys %s:%s: %w", by, selector, err)
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("element never located")
	}
	return fmt.Errorf("fill %s:%s: %w", by, selector, lastErr)
}

func clickElementWithRetry(driver selenium.WebDriver, by, selector string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		elem, err := driver.FindElement(by, selector)
		if err != nil {
			lastErr = err
			time.Sleep(200 * time.Millisecond)
			continue
		}
		if err := elem.Click(); err != nil {
			lastErr = err
			if isStaleElementErr(err) {
				time.Sleep(150 * time.Millisecond)
				continue
			}
			return fmt.Errorf("click %s:%s: %w", by, selector, err)
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("element never located")
	}
	return fmt.Errorf("click %s:%s: %w", by, selector, lastErr)
}

func isStaleElementErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "stale element reference")
}

func waitForGrievanceElement(driver selenium.WebDriver, description string, timeout time.Duration) (selenium.WebElement, error) {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		elements, err := driver.FindElements(selenium.ByCSSSelector, "ul li")
		if err != nil {
			lastErr = err
			time.Sleep(400 * time.Millisecond)
			continue
		}
		for _, item := range elements {
			pre, err := item.FindElement(selenium.ByCSSSelector, "pre")
			if err != nil {
				continue
			}
			text, err := pre.Text()
			if err != nil {
				continue
			}
			if strings.TrimSpace(text) == description {
				return item, nil
			}
		}
		time.Sleep(400 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no grievances rendered")
	}
	return nil, fmt.Errorf("grievance %q not found: %w", description, lastErr)
}
