package selenium_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	api, err := apiRoot()
	if err != nil {
		t.Fatalf("could not determine api root: %v", err)
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

	idToken, err := waitForOIDCToken(driver, expectedIssuer, 30*time.Second)
	if err != nil {
		t.Fatalf("wait for id token: %v", err)
	}

	if err := waitForAdminUID(api, idToken, oidc.LocalSubject, 10*time.Second); err != nil {
		t.Fatalf("admin uid endpoint: %v", err)
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

	if err := waitForCallboxSettings(api, idToken, fallbackValue, authorizerNumber, entryCodeValue, false, 20*time.Second); err != nil {
		t.Fatalf("callbox settings verification failed: %v", err)
	}

	time.Sleep(2 * time.Second)

	if err := driver.Get(adminURL.String()); err != nil {
		t.Fatalf("reload admin after save: %v", err)
	}

	if err := waitForText(driver, "You are logged in.", 30*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("wait for login text post-save: %v (body snippet: %v)", err, body)
	}

	reloadedFallback, err := waitForElement(driver, selenium.ByCSSSelector, "input[id$='fallbackPhone']", 10*time.Second)
	if err != nil {
		t.Fatalf("fallback phone input after reload: %v", err)
	}
	if val, err := driver.ExecuteScript("return arguments[0]?.value ?? '';", []any{reloadedFallback}); err != nil {
		t.Fatalf("read fallback phone after reload: %v", err)
	} else if valueStr, ok := val.(string); !ok || strings.TrimSpace(valueStr) != fallbackValue {
		t.Fatalf("unexpected fallback phone after reload: %v", val)
	}

	authorizerReloaded, err := waitForElement(driver, selenium.ByCSSSelector, "input[name='authorizers.0.phoneNumber']", 10*time.Second)
	if err != nil {
		t.Fatalf("authorizer input after reload: %v", err)
	}
	if val, err := driver.ExecuteScript("return arguments[0]?.value ?? '';", []any{authorizerReloaded}); err != nil {
		t.Fatalf("read authorizer after reload: %v", err)
	} else if valueStr, ok := val.(string); !ok || strings.TrimSpace(valueStr) != authorizerNumber {
		t.Fatalf("unexpected authorizer phone after reload: %v", val)
	}

	entryCodeReloaded, err := waitForElement(driver, selenium.ByCSSSelector, "input[name='entryCodes.0.code']", 10*time.Second)
	if err != nil {
		t.Fatalf("entry code input after reload: %v", err)
	}
	if val, err := driver.ExecuteScript("return arguments[0]?.value ?? '';", []any{entryCodeReloaded}); err != nil {
		t.Fatalf("read entry code after reload: %v", err)
	} else if valueStr, ok := val.(string); !ok || strings.TrimSpace(valueStr) != entryCodeValue {
		t.Fatalf("unexpected entry code after reload: %v", val)
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

func waitForAdminUID(api url.URL, token, expected string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{}

	endpoint := api
	endpoint.Path = "/admin/uid"

	var lastStatus int
	var lastBody string

	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", token)

		resp, err := client.Do(req)
		if err == nil {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			lastStatus = resp.StatusCode
			lastBody = strings.TrimSpace(string(bodyBytes))

			if resp.StatusCode == http.StatusOK && lastBody == expected {
				return nil
			}
		}

		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("admin uid did not reach expected value: status %d body %q", lastStatus, lastBody)
}

func waitForCallboxSettings(api url.URL, token string, expectedFallback, expectedAuthorizer, expectedEntryCode string, expectedParty bool, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{}

	endpoint := api
	endpoint.Path = "/callbox/settings"

	var lastStatus int
	var lastBody string

	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", token)

		resp, err := client.Do(req)
		if err == nil {
			if resp.StatusCode == http.StatusOK {
				var body struct {
					Authorizers []struct {
						PhoneNumber string `json:"phoneNumber"`
					} `json:"authorizers"`
					EntryCodes []struct {
						Code string `json:"code"`
					} `json:"entryCodes"`
					FallbackPhone string `json:"fallbackPhone"`
					PartyMode     *bool  `json:"partyMode"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&body); err == nil {
					resp.Body.Close()
					partyValue := false
					if body.PartyMode != nil {
						partyValue = *body.PartyMode
					}
					hasAuthorizer := len(body.Authorizers) > 0 && strings.TrimSpace(body.Authorizers[0].PhoneNumber) == expectedAuthorizer
					hasEntryCode := len(body.EntryCodes) > 0 && strings.TrimSpace(body.EntryCodes[0].Code) == expectedEntryCode
					if strings.TrimSpace(body.FallbackPhone) == expectedFallback && partyValue == expectedParty && hasAuthorizer && hasEntryCode {
						return nil
					}
					lastStatus = resp.StatusCode
					lastBody = fmt.Sprintf("fallback=%s partyMode=%v authorizers=%v entryCodes=%v", body.FallbackPhone, partyValue, body.Authorizers, body.EntryCodes)
					time.Sleep(250 * time.Millisecond)
					continue
				}
			}
			if resp.Body != nil {
				data, _ := io.ReadAll(resp.Body)
				lastBody = strings.TrimSpace(string(data))
			}
			lastStatus = resp.StatusCode
			resp.Body.Close()
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("callbox settings did not reach expected state: status %d body %q", lastStatus, lastBody)
}
