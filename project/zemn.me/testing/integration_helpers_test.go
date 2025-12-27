package selenium_test

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

type ServicePorts struct {
	NextServerPort string `json:"@@//project/zemn.me:itest_service"`
	APIPort        string `json:"@@//project/zemn.me/api/cmd/localserver:localserver_itest_service"`
	OIDCProvider   string `json:"@@//project/zemn.me/testing:oidc_provider_itest_service"`
}

func servicePorts() (p ServicePorts, err error) {
	if err = json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &p); err != nil {
		return
	}

	return
}

func nextServerRoot() (u url.URL, err error) {
	ports, err := servicePorts()
	if err != nil {
		return
	}

	return url.URL{
		Scheme: "http",
		Host:   "localhost:" + ports.NextServerPort,
	}, nil
}

func apiRoot() (url.URL, error) {
	ports, err := servicePorts()
	if err != nil {
		return url.URL{}, err
	}
	if ports.APIPort == "" {
		return url.URL{}, fmt.Errorf("api port not found in ASSIGNED_PORTS")
	}

	return url.URL{
		Scheme: "http",
		Host:   "localhost:" + ports.APIPort,
	}, nil
}

func testEndpointHasNoLogErrors(t *testing.T, ep string) {
	d, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer d.Close()

	u, err := url.Parse(ep)
	if err != nil {
		t.Fatal(err)
	}

	if err := d.Get(ep); err != nil {
		t.Fatalf("get: %v", err)
	}

	origin := url.URL{
		Scheme: u.Scheme,
		Host:   u.Host,
	}

	time.Sleep(1 * time.Second)

	logs, _ := d.Log(log.Browser)
	cu, _ := d.CurrentURL()
	filtered := filterErrorsWeDontCareAbout(logs)
	// don't error if we were redirected
	if len(filtered) > 0 && strings.HasPrefix(cu, origin.String()) {
		t.Fatalf("%+q logged %+v", ep, filtered)
	}
}

func filterErrorsWeDontCareAbout(in []log.Message) (out []log.Message) {
	out = make([]log.Message, 0, len(in))
	for _, l := range in {
		if strings.Contains(l.Message, "source map") ||
			strings.Contains(l.Message, "react-dev-overlay") {
			continue
		}
		out = append(out, l)
	}

	return
}

const loginButtonSelector = "button[aria-label='Authenticate with OIDC']"

func waitForLoginButtonReady(driver selenium.WebDriver, timeout time.Duration) (selenium.WebElement, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		button, err := driver.FindElement(selenium.ByCSSSelector, loginButtonSelector)
		if err == nil {
			enabled, err := button.IsEnabled()
			if err == nil && enabled {
				return button, nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return nil, fmt.Errorf("login button did not become enabled")
}

func performOIDCLogin(driver selenium.WebDriver, loginLabel string, timeout time.Duration) error {
	originalHandle, err := driver.CurrentWindowHandle()
	if err != nil {
		return fmt.Errorf("current window handle: %w", err)
	}

	existingHandles, err := driver.WindowHandles()
	if err != nil {
		return fmt.Errorf("list window handles: %w", err)
	}

	loginButton, err := waitForLoginButtonReady(driver, timeout)
	if err != nil {
		return fmt.Errorf("prepare login button: %w", err)
	}
	if err := loginButton.Click(); err != nil {
		return fmt.Errorf("click login button: %w", err)
	}

	newHandle, err := waitForNewWindow(driver, existingHandles, timeout)
	if err != nil {
		return err
	}
	if err := driver.SwitchWindow(newHandle); err != nil {
		return fmt.Errorf("switch to provider window: %w", err)
	}

	loginButtonXPath := fmt.Sprintf("//button[contains(normalize-space(.), '%s')]", loginLabel)
	quickButton, err := waitForElement(driver, selenium.ByXPATH, loginButtonXPath, 10*time.Second)
	if err != nil {
		return fmt.Errorf("locate quick login button: %w", err)
	}
	if err := quickButton.Click(); err != nil {
		return fmt.Errorf("submit quick login: %w", err)
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		handles, err := driver.WindowHandles()
		if err == nil {
			if len(handles) == 1 && handles[0] == originalHandle {
				if err := driver.SwitchWindow(originalHandle); err != nil {
					return fmt.Errorf("return to original window: %w", err)
				}
				return nil
			}
		}
		time.Sleep(200 * time.Millisecond)
	}

	_ = driver.SwitchWindow(originalHandle)
	return fmt.Errorf("login window did not close")
}

func login(t *testing.T, driver selenium.WebDriver) {
	t.Helper()
	if alreadyLoggedIn(driver) {
		return
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

func waitForNewWindow(driver selenium.WebDriver, existing []string, timeout time.Duration) (string, error) {
	existingSet := make(map[string]struct{}, len(existing))
	for _, h := range existing {
		existingSet[h] = struct{}{}
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		handles, err := driver.WindowHandles()
		if err == nil {
			for _, h := range handles {
				if _, ok := existingSet[h]; !ok {
					return h, nil
				}
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	return "", fmt.Errorf("timed out waiting for login window")
}

func waitForElement(driver selenium.WebDriver, by, value string, timeout time.Duration) (selenium.WebElement, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		elem, err := driver.FindElement(by, value)
		if err == nil {
			return elem, nil
		}
		time.Sleep(250 * time.Millisecond)
	}
	return nil, fmt.Errorf("element %s:%s not found", by, value)
}

func waitForNoElement(driver selenium.WebDriver, by, value string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		_, err := wd.FindElement(by, value)
		if err != nil {
			return true, nil
		}
		return false, nil
	}, timeout)
}

func waitForText(driver selenium.WebDriver, substr string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		res, err := wd.ExecuteScript("return document.body ? document.body.innerText : ''", nil)
		if err != nil {
			return false, nil
		}
		text, _ := res.(string)
		return strings.Contains(text, substr), nil
	}, timeout)
}

func alreadyLoggedIn(driver selenium.WebDriver) bool {
	if _, err := driver.FindElement(selenium.ByXPATH, "//*[contains(text(),'You are logged in.')]"); err == nil {
		return true
	}
	return false
}
