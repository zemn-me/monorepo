package selenium_test

import (
	"testing"
	"time"

	"github.com/tebeka/selenium"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	"github.com/zemn-me/monorepo/project/me/zemn/testing/browserhelpers"
)

func TestKeyPageUnlockedPadlockLocksAgain(t *testing.T) {
	root, err := browserhelpers.FrontendRoot()
	if err != nil {
		t.Fatalf("could not find frontend root: %v", err)
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

	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatalf("oidc login: %v", err)
	}

	unlockButton, err := browserhelpers.WaitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Unlock Door']", 30*time.Second)
	if err != nil {
		t.Fatalf("unlock button: %v", err)
	}
	if err := unlockButton.Click(); err != nil {
		t.Fatalf("click unlock button: %v", err)
	}
	if err := browserhelpers.WaitForText(driver, "unlocked", 30*time.Second); err != nil {
		t.Fatalf("key history event: %v", err)
	}
	browserhelpers.AssertNoSevereBrowserLogs(t, driver)

	lockButton, err := browserhelpers.WaitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Lock Door']", 30*time.Second)
	if err != nil {
		t.Fatalf("lock button after unlock: %v", err)
	}
	if err := lockButton.Click(); err != nil {
		t.Fatalf("click unlocked padlock: %v", err)
	}

	if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "button[aria-label='Unlock Door']", 30*time.Second); err != nil {
		t.Fatalf("unlock button after lock: %v", err)
	}
	if err := browserhelpers.WaitForText(driver, "Locked.", 30*time.Second); err != nil {
		t.Fatalf("locked status after relock: %v", err)
	}

	time.Sleep(2 * time.Second)
	if _, err := driver.FindElement(selenium.ByCSSSelector, "button[aria-label='Lock Door']"); err == nil {
		t.Fatalf("door returned to unlocked state after refetch")
	}
}
