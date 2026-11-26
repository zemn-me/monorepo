package browserhelpers

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"slices"
	"strings"
	"testing"
	"time"
	_ "time/tzdata" // Date assertions must not depend on executor zoneinfo packages.

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

type servicePorts struct {
	Frontend string `json:"@@//project/me/zemn:itest_service_calendar_fixture"`
	API      string `json:"@@//project/me/zemn/api/cmd/localserver:localserver_calendar_fixture_itest_service"`
}

func assignedPorts() (servicePorts, error) {
	var ports servicePorts
	err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports)
	return ports, err
}

func FrontendRoot() (url.URL, error) {
	ports, err := assignedPorts()
	if err != nil {
		return url.URL{}, err
	}
	if ports.Frontend == "" {
		return url.URL{}, fmt.Errorf("frontend port not found in ASSIGNED_PORTS")
	}
	return url.URL{Scheme: "http", Host: "localhost:" + ports.Frontend}, nil
}

func APIRoot() (url.URL, error) {
	ports, err := assignedPorts()
	if err != nil {
		return url.URL{}, err
	}
	if ports.API == "" {
		return url.URL{}, fmt.Errorf("api port not found in ASSIGNED_PORTS")
	}
	return url.URL{Scheme: "http", Host: "localhost:" + ports.API}, nil
}

func AssertEndpointHasNoLogErrors(t *testing.T, ep string) {
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
		if strings.Contains(l.Message, "Ignoring Event: localhost") ||
			strings.Contains(l.Message, "source map") ||
			strings.Contains(l.Message, "react-dev-overlay") {
			continue
		}
		out = append(out, l)
	}

	return
}

const loginButtonSelector = "button[aria-label='Authenticate with OIDC']"

func WaitForLoginButtonReady(driver selenium.WebDriver, timeout ...time.Duration) (selenium.WebElement, error) {
	return WaitForEnabledElement(driver, selenium.ByCSSSelector, loginButtonSelector, timeout...)
}

func PerformOIDCLogin(driver selenium.WebDriver, loginLabel string, timeout ...time.Duration) error {
	originalHandle, err := driver.CurrentWindowHandle()
	if err != nil {
		return fmt.Errorf("current window handle: %w", err)
	}
	existingHandles, err := driver.WindowHandles()
	if err != nil {
		return fmt.Errorf("list window handles: %w", err)
	}
	if err := ClickElementWithRetry(driver, selenium.ByCSSSelector, loginButtonSelector, timeout...); err != nil {
		return fmt.Errorf("click login button: %w", err)
	}

	var popup string
	if err := waitFor(driver, func(d selenium.WebDriver) (bool, error) {
		handles, err := d.WindowHandles()
		for _, h := range handles {
			if !slices.Contains(existingHandles, h) {
				popup = h
				break
			}
		}
		return popup != "", err
	}, timeout); err != nil {
		return fmt.Errorf("wait for provider window: %w", err)
	}
	if err := driver.SwitchWindow(popup); err != nil {
		return fmt.Errorf("switch to provider window: %w", err)
	}
	loginButtonXPath := fmt.Sprintf("//button[contains(normalize-space(.), '%s')]", loginLabel)
	if err := ClickElementWithRetry(driver, selenium.ByXPATH, loginButtonXPath, timeout...); err != nil {
		return fmt.Errorf("submit quick login: %w", err)
	}
	if err := driver.SwitchWindow(originalHandle); err != nil {
		return fmt.Errorf("return to original window: %w", err)
	}
	// Popup closure can precede the main page's signed-in render.
	if err := waitFor(driver, func(d selenium.WebDriver) (bool, error) {
		handles, err := d.WindowHandles()
		if err != nil || slices.Contains(handles, popup) {
			return false, err
		}
		buttons, err := d.FindElements(selenium.ByCSSSelector, "[data-glade-footer] button[aria-label='Log out']")
		if err != nil || len(buttons) == 0 {
			return false, err
		}
		visible, err := buttons[0].IsDisplayed()
		if IsStaleElementErr(err) {
			return false, nil
		}
		return visible, err
	}, timeout); err != nil {
		return fmt.Errorf("wait for signed-in page: %w", err)
	}
	return nil
}

func WaitForElement(driver selenium.WebDriver, by, value string, timeout ...time.Duration) (selenium.WebElement, error) {
	var element selenium.WebElement
	err := waitFor(driver, func(d selenium.WebDriver) (bool, error) {
		elements, err := d.FindElements(by, value)
		if err == nil && len(elements) > 0 {
			element = elements[0]
		}
		return element != nil, err
	}, timeout)
	if err != nil {
		return nil, fmt.Errorf("find %s:%s: %w", by, value, err)
	}
	return element, nil
}

func WaitForEnabledElement(driver selenium.WebDriver, by, value string, timeout ...time.Duration) (selenium.WebElement, error) {
	var element selenium.WebElement
	err := waitFor(driver, func(d selenium.WebDriver) (bool, error) {
		elements, err := d.FindElements(by, value)
		if err != nil || len(elements) == 0 {
			return false, err
		}
		enabled, err := elements[0].IsEnabled()
		if IsStaleElementErr(err) {
			return false, nil
		}
		if enabled {
			element = elements[0]
		}
		return enabled, err
	}, timeout)
	if err != nil {
		return nil, fmt.Errorf("find enabled %s:%s: %w", by, value, err)
	}
	return element, nil
}

// Selenium's default scrolling can leave a control beneath a sticky toolbar.
func ClickElementInView(driver selenium.WebDriver, element selenium.WebElement) error {
	if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});`, []any{element}); err != nil {
		return err
	}
	return element.Click()
}

// React may replace an element between lookup and click. Only retry stale
// references and wait for enabled controls; other click failures still fail.
func ClickElementWithRetry(driver selenium.WebDriver, by, selector string, timeout ...time.Duration) error {
	err := waitFor(driver, func(d selenium.WebDriver) (bool, error) {
		elements, err := d.FindElements(by, selector)
		if err != nil || len(elements) == 0 {
			return false, err
		}
		enabled, err := elements[0].IsEnabled()
		if err == nil && enabled {
			err = elements[0].Click()
		}
		if IsStaleElementErr(err) {
			return false, nil
		}
		return enabled, err
	}, timeout)
	if err != nil {
		return fmt.Errorf("click %s:%s: %w", by, selector, err)
	}
	return nil
}

// SelectFiles reacquires file inputs replaced during rendering. A stale file
// selection has not selected files; other errors are terminal.
func SelectFiles(driver selenium.WebDriver, by, selector string, paths []string, timeout ...time.Duration) error {
	return waitFor(driver, func(wd selenium.WebDriver) (bool, error) {
		element, err := wd.FindElement(by, selector)
		if err != nil {
			if strings.Contains(err.Error(), "no such element") {
				return false, nil
			}
			return false, err
		}
		err = element.SendKeys(strings.Join(paths, "\n"))
		if IsStaleElementErr(err) {
			return false, nil
		}
		return err == nil, err
	}, timeout)
}

func IsStaleElementErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "stale element reference")
}

func WaitForNoElement(driver selenium.WebDriver, by, value string, timeout ...time.Duration) error {
	return waitFor(driver, func(wd selenium.WebDriver) (bool, error) {
		elements, err := wd.FindElements(by, value)
		return len(elements) == 0, err
	}, timeout)
}

func WaitForText(driver selenium.WebDriver, substr string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		res, err := wd.ExecuteScript("return document.body ? document.body.innerText : ''", nil)
		if err != nil {
			return false, nil
		}
		text, _ := res.(string)
		return strings.Contains(text, substr), nil
	}, timeout)
}

func AssertNoSevereBrowserLogs(t *testing.T, driver selenium.WebDriver) {
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

func DumpPageDiagnostics(t *testing.T, driver selenium.WebDriver) {
	if state, err := driver.ExecuteScript(`return JSON.stringify({
		visibility: document.visibilityState, focused: document.hasFocus(),
		online: navigator.onLine, ready: document.readyState,
	});`, nil); err == nil {
		t.Logf("browser page state: %s", state)
	}
	if capture, err := driver.ExecuteScript(`
		const capture = document.querySelector('section[aria-label="Create a journal entry"]');
		return capture ? JSON.stringify({
			text: capture.innerText,
			busy: capture.getAttribute('aria-busy'),
			buttons: [...capture.querySelectorAll('button')].map(button => ({
				label: button.getAttribute('aria-label'), disabled: button.disabled,
			})),
		}) : '';
	`, nil); err == nil && capture != "" {
		t.Logf("journal capture controls: %s", capture)
	}
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

func TestWAV() []byte {
	const (
		sampleRate     = 8000
		seconds        = 12
		bytesPerSample = 2
	)
	dataSize := sampleRate * seconds * bytesPerSample
	buffer := bytes.NewBuffer(make([]byte, 0, 44+dataSize))
	buffer.WriteString("RIFF")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(36+dataSize))
	buffer.WriteString("WAVEfmt ")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(16))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate*bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(8*bytesPerSample))
	buffer.WriteString("data")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(dataSize))
	buffer.Write(make([]byte, dataSize))
	return buffer.Bytes()
}
