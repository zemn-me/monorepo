package selenium_test

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	"github.com/zemn-me/monorepo/project/zemn.me/testing/oidc"
)

func TestAdminSettingsEndToEnd(t *testing.T) {
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

	adminURL := root
	adminURL.Path = "/admin"

	if err := driver.Get(adminURL.String()); err != nil {
		t.Fatalf("navigate admin: %v", err)
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
		t.Logf("admin hostname: %v", hostVal)
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

	syncIndicatorSelector := "output[aria-label='Callbox settings status']"
	syncIndicatorSyncedSelector := syncIndicatorSelector + "[aria-busy='false']"
	syncIndicatorBusySelector := syncIndicatorSelector + "[aria-busy='true']"
	uidValueSelector := "output[aria-label='Admin UID value']"
	if _, err := waitForElement(driver, selenium.ByCSSSelector, syncIndicatorSyncedSelector, 30*time.Second); err != nil {
		t.Fatalf("initial settings sync: %v", err)
	}
	if err := expectElementText(driver, uidValueSelector, oidc.LocalSubject, 10*time.Second); err != nil {
		t.Fatalf("admin uid mismatch: %v", err)
	}

	if _, err := waitForOIDCToken(driver, expectedIssuer, 30*time.Second); err != nil {
		t.Fatalf("wait for id token: %v", err)
	}

	authorizerNumber := fmt.Sprintf("+1202556%04d", time.Now().UnixNano()%10000)
	entryCodeValue := fmt.Sprintf("%05d", time.Now().UnixNano()%100000)
	fallbackValue := fmt.Sprintf("+1202555%04d", (time.Now().UnixNano()/2)%10000)

	authorizerAddButton, err := waitForElement(driver, selenium.ByXPATH, "//fieldset[legend[normalize-space()='Authorizers']]//button[normalize-space()='+']", 10*time.Second)
	if err != nil {
		t.Fatalf("authorizer add button: %v", err)
	}
	if err := authorizerAddButton.Click(); err != nil {
		t.Fatalf("click authorizer add button: %v", err)
	}

	authorizerInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[name='authorizers.0.phoneNumber']", 10*time.Second)
	if err != nil {
		t.Fatalf("authorizer phone input: %v", err)
	}
	if err := authorizerInput.Clear(); err != nil {
		t.Fatalf("clear authorizer phone: %v", err)
	}
	if err := authorizerInput.SendKeys(authorizerNumber); err != nil {
		t.Fatalf("fill authorizer phone: %v", err)
	}

	entryCodeAddButton, err := waitForElement(driver, selenium.ByXPATH, "//fieldset[legend[normalize-space()='Entry Codes']]//button[normalize-space()='+']", 10*time.Second)
	if err != nil {
		t.Fatalf("entry code add button: %v", err)
	}
	if err := entryCodeAddButton.Click(); err != nil {
		t.Fatalf("click entry code add button: %v", err)
	}

	entryCodeInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[name='entryCodes.0.code']", 10*time.Second)
	if err != nil {
		t.Fatalf("entry code input: %v", err)
	}
	if err := entryCodeInput.Clear(); err != nil {
		t.Fatalf("clear entry code: %v", err)
	}
	if err := entryCodeInput.SendKeys(entryCodeValue); err != nil {
		t.Fatalf("fill entry code: %v", err)
	}

	fallbackInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[id$='fallbackPhone']", 10*time.Second)
	if err != nil {
		t.Fatalf("fallback phone input: %v", err)
	}
	if err := fallbackInput.Clear(); err != nil {
		t.Fatalf("clear fallback phone: %v", err)
	}
	if err := fallbackInput.SendKeys(fallbackValue); err != nil {
		t.Fatalf("fill fallback phone: %v", err)
	}

	partyCheckbox, err := waitForElement(driver, selenium.ByCSSSelector, "input[type='checkbox'][id$='partyMode']", 10*time.Second)
	if err != nil {
		t.Fatalf("party mode checkbox: %v", err)
	}
	isSelected, err := partyCheckbox.IsSelected()
	if err != nil {
		t.Fatalf("read initial party mode state: %v", err)
	}
	if isSelected {
		if err := partyCheckbox.Click(); err != nil {
			t.Fatalf("ensure party mode unchecked: %v", err)
		}
	}

	submit, err := waitForElement(driver, selenium.ByCSSSelector, "form input[type='submit']", 10*time.Second)
	if err != nil {
		t.Fatalf("submit button: %v", err)
	}
	if err := submit.Click(); err != nil {
		t.Fatalf("submit admin form: %v", err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, syncIndicatorBusySelector, 5*time.Second); err != nil {
		t.Fatalf("settings sync indicator did not enter pending state: %v", err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, syncIndicatorSyncedSelector, 30*time.Second); err != nil {
		t.Fatalf("settings sync indicator did not return to synced: %v", err)
	}

	if err := driver.Get(adminURL.String()); err != nil {
		t.Fatalf("reload admin after save: %v", err)
	}

	if err := waitForText(driver, "You are logged in.", 30*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("wait for login text post-save: %v (body snippet: %v)", err, body)
	}
	if err := expectElementText(driver, uidValueSelector, oidc.LocalSubject, 10*time.Second); err != nil {
		t.Fatalf("admin uid mismatch after reload: %v", err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, syncIndicatorSyncedSelector, 30*time.Second); err != nil {
		t.Fatalf("settings sync indicator after reload: %v", err)
	}

	if err := expectInputValue(driver, "input[id$='fallbackPhone']", fallbackValue, 10*time.Second); err != nil {
		t.Fatalf("fallback phone after reload: %v", err)
	}
	if err := expectInputValue(driver, "input[name='authorizers.0.phoneNumber']", authorizerNumber, 10*time.Second); err != nil {
		t.Fatalf("authorizer after reload: %v", err)
	}
	if err := expectInputValue(driver, "input[name='entryCodes.0.code']", entryCodeValue, 10*time.Second); err != nil {
		t.Fatalf("entry code after reload: %v", err)
	}

	reloadedParty, err := waitForElement(driver, selenium.ByCSSSelector, "input[type='checkbox'][id$='partyMode']", 10*time.Second)
	if err != nil {
		t.Fatalf("party mode checkbox after reload: %v", err)
	}
	if selected, err := reloadedParty.IsSelected(); err != nil {
		t.Fatalf("read party mode selected state after reload: %v", err)
	} else if selected {
		t.Fatalf("party mode checkbox unexpectedly selected after reload")
	}
}

func expectElementText(driver selenium.WebDriver, selector string, expected string, timeout time.Duration) error {
	elem, err := waitForElement(driver, selenium.ByCSSSelector, selector, timeout)
	if err != nil {
		return err
	}
	val, err := driver.ExecuteScript("return (arguments[0]?.textContent ?? '').trim();", []any{elem})
	if err != nil {
		return err
	}
	valueStr, _ := val.(string)
	if strings.TrimSpace(valueStr) != expected {
		return fmt.Errorf("unexpected text for %s: got %q want %q", selector, valueStr, expected)
	}
	return nil
}

func expectInputValue(driver selenium.WebDriver, selector string, expected string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		elem, err := driver.FindElement(selenium.ByCSSSelector, selector)
		if err != nil {
			time.Sleep(250 * time.Millisecond)
			continue
		}
		val, err := driver.ExecuteScript("return (arguments[0]?.value ?? '').trim();", []any{elem})
		if err != nil {
			return err
		}
		valueStr, _ := val.(string)
		if strings.TrimSpace(valueStr) == expected {
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("input %s did not reach value %q", selector, expected)
}
