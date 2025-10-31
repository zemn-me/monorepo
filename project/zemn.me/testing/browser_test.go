// browser_test exercises the zemn.me static site plus the local API server.
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

func waitForRequestURLFromButton(driver selenium.WebDriver, expectedPrefix string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	var lastValue string
	for time.Now().Before(deadline) {
		if button, err := driver.FindElement(selenium.ByCSSSelector, "button[data-testid='oidc-login-button']"); err == nil {
			if attr, err := button.GetAttribute("data-request-url"); err == nil && attr != "" {
				if strings.HasPrefix(attr, expectedPrefix) {
					return attr, nil
				}
				return "", fmt.Errorf("unexpected authorization URL %q (expected prefix %q)", attr, expectedPrefix)
			}
		}
		if value, err := driver.ExecuteScript("return window.__oidcRequestURL || '';", nil); err == nil {
			if url, ok := value.(string); ok && url != "" {
				if strings.HasPrefix(url, expectedPrefix) {
					return url, nil
				}
				return "", fmt.Errorf("unexpected authorization URL %q (expected prefix %q)", url, expectedPrefix)
			}
			if url, ok := value.(string); ok {
				lastValue = url
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	if lastValue == "" {
		return "", fmt.Errorf("timed out waiting for OIDC request URL")
	}
	return "", fmt.Errorf("timed out waiting for OIDC request URL (last value %q)", lastValue)
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

	loginButton, err := waitForElement(driver, selenium.ByCSSSelector, "button[data-testid='oidc-login-button']", 10*time.Second)
	if err != nil {
		return fmt.Errorf("find login button: %w", err)
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

func readOIDCToken(driver selenium.WebDriver, issuer string) (string, bool, error) {
	value, err := driver.ExecuteScript(`(function(issuer) {
	const cache = localStorage.getItem('1');
	if (!cache) return { token: null };
	try {
	  const parsed = JSON.parse(cache);
	  const entry = parsed && typeof parsed === 'object' ? parsed[issuer] : null;
	  if (entry && typeof entry.id_token === 'string') {
	    return { token: entry.id_token };
	  }
	  return { token: null };
	} catch (err) {
	  return { error: String(err) };
	}
})(arguments[0]);`, []any{issuer})
	if err != nil {
		return "", false, err
	}
	if value == nil {
		return "", false, nil
	}
	data := map[string]any{}
	switch v := value.(type) {
	case map[string]any:
		data = v
	case map[any]any:
		for key, val := range v {
			if keyStr, ok := key.(string); ok {
				data[keyStr] = val
			}
		}
	default:
		return "", false, fmt.Errorf("unexpected token cache response type %T", value)
	}
	if errMsg, ok := data["error"].(string); ok && errMsg != "" {
		return "", false, fmt.Errorf("read id_token: %s", errMsg)
	}
	if token, ok := data["token"].(string); ok && token != "" {
		return token, true, nil
	}
	return "", false, nil
}
