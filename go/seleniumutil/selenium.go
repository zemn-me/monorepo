package selenium

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"github.com/tebeka/selenium"
)

// Driver embeds selenium.WebDriver and cleans itself up via Close().
type Driver struct {
	selenium.WebDriver
	svc *selenium.Service
	url string
}

// Close satisfies io.Closer.
func (d *Driver) Close() error {
	if d.WebDriver != nil {
		_ = d.WebDriver.Quit()
	}
	if d.svc != nil {
		return d.svc.Stop()
	}
	return nil
}

// New starts chromedriver on a free port, opens a headless Chrome session,
// and returns a Driver ready to use.
func New() (*Driver, error) {
	chrome, err := runfiles.Rlocation(chromiumRlocationPath)
	if err != nil {
		return nil, fmt.Errorf("locate chromium: %w", err)
	}
	driverBin, err := runfiles.Rlocation(chromeDriverRlocationPath)
	if err != nil {
		return nil, fmt.Errorf("locate chromedriver: %w", err)
	}

	// Sanity-check the binaries exist.
	for _, p := range []struct{ path, label string }{
		{chrome, "chromium"}, {driverBin, "chromedriver"},
	} {
		if fi, err := os.Stat(p.path); err != nil || fi.IsDir() {
			return nil, fmt.Errorf("can't find %s at %s", p.label, p.path)
		}
	}

	port, err := freePort()
	if err != nil {
		return nil, err
	}

	svc, err := selenium.NewChromeDriverService(
		driverBin, port,
		selenium.ChromeDriver(chrome), // tell driver where Chromium lives
	)
	if err != nil {
		return nil, fmt.Errorf("start chromedriver: %w", err)
	}

	caps := selenium.Capabilities{
		"browserName": "chrome",
		"goog:chromeOptions": map[string]any{
			"binary": chrome,
			"args": []string{
				"--headless",
				"--no-sandbox",
				"--disable-dev-shm-usage",
			},
		},
	}

	remoteURL := fmt.Sprintf("http://localhost:%d/wd/hub", port)
	wd, err := selenium.NewRemote(caps, remoteURL)
	if err != nil {
		_ = svc.Stop()
		return nil, err
	}

	return &Driver{WebDriver: wd, svc: svc, url: remoteURL}, nil
}

// SetTimezoneOverride configures Chromium to report the provided time zone ID.
func (d *Driver) SetTimezoneOverride(tz string) error {
	if d.WebDriver == nil {
		return fmt.Errorf("web driver not initialized")
	}
	sessionID := d.SessionID()
	if sessionID == "" {
		return fmt.Errorf("missing session id")
	}
	payload := map[string]any{
		"cmd": "Emulation.setTimezoneOverride",
		"params": map[string]string{
			"timezoneId": tz,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal timezone payload: %w", err)
	}

	// it's crazy that codex had a hard time setting the time zone
	// and decided to just hand-form this
	primary := fmt.Sprintf("%s/session/%s/chromium/send_command_and_get_result", d.url, sessionID)
	if err := d.postChromiumCommand(primary, body); err != nil {
		var statusErr *httpStatusError
		if errors.As(err, &statusErr) && statusErr.Code == http.StatusNotFound {
			fallback := fmt.Sprintf("%s/session/%s/chromium/send_command", d.url, sessionID)
			return d.postChromiumCommand(fallback, body)
		}
		return err
	}
	return nil
}

type httpStatusError struct {
	Code int
	Body string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("chromium command failed (%d): %s", e.Code, e.Body)
}

func (d *Driver) postChromiumCommand(url string, body []byte) error {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build chromium request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := selenium.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute chromium command: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(resp.Body)
		return &httpStatusError{Code: resp.StatusCode, Body: string(msg)}
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

// freePort asks the kernel for any available TCP port.
func freePort() (int, error) {
	l, err := net.Listen("tcp", ":0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}
