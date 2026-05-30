package selenium_test

import (
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestKeyPageUnlockedPadlockLocksAgain(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	keyURL := root
	keyURL.Path = "/key"
	if err := driver.Get(keyURL.String()); err != nil {
		t.Fatalf("navigate key page: %v", err)
	}

	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatalf("oidc login: %v", err)
	}

	unlockButton, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Unlock Door']", 30*time.Second)
	if err != nil {
		t.Fatalf("unlock button: %v", err)
	}
	if err := unlockButton.Click(); err != nil {
		t.Fatalf("click unlock button: %v", err)
	}
	if err := waitForText(driver, "unlocked", 30*time.Second); err != nil {
		t.Fatalf("key history event: %v", err)
	}
	assertNoSevereBrowserLogs(t, driver)

	lockButton, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Lock Door']", 30*time.Second)
	if err != nil {
		t.Fatalf("lock button after unlock: %v", err)
	}
	if err := lockButton.Click(); err != nil {
		t.Fatalf("click unlocked padlock: %v", err)
	}

	if _, err := waitForElement(driver, selenium.ByCSSSelector, "button[aria-label='Unlock Door']", 30*time.Second); err != nil {
		t.Fatalf("unlock button after lock: %v", err)
	}
	if err := waitForText(driver, "Locked.", 30*time.Second); err != nil {
		t.Fatalf("locked status after relock: %v", err)
	}

	time.Sleep(2 * time.Second)
	if _, err := driver.FindElement(selenium.ByCSSSelector, "button[aria-label='Lock Door']"); err == nil {
		t.Fatalf("door returned to unlocked state after refetch")
	}
}

func assertNoSevereBrowserLogs(t *testing.T, driver selenium.WebDriver) {
	t.Helper()
	logs, err := driver.Log(log.Browser)
	if err != nil {
		t.Logf("browser log unavailable: %v", err)
		return
	}
	for _, entry := range filterErrorsWeDontCareAbout(logs) {
		if entry.Level == log.Severe {
			t.Fatalf("browser console error: %s", entry.Message)
		}
	}
}
