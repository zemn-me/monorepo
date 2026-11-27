package browserhelpers

import (
	"fmt"
	"maps"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

// ClockedBrowser starts each document with application timers and animation
// frames paused. Requests still go to the real services.
type ClockedBrowser struct {
	*seleniumpkg.Driver
	*seleniumpkg.VirtualClock
}

func NewClockedBrowser(capabilities selenium.Capabilities, arguments ...string) (*ClockedBrowser, error) {
	options := selenium.Capabilities{
		"pageLoadStrategy": "eager",
		"timeouts":         map[string]any{"script": nil},
	}
	maps.Copy(options, capabilities)
	driver, err := seleniumpkg.NewWithChromeCapabilities(options, arguments...)
	if err != nil {
		return nil, err
	}
	clock, err := seleniumpkg.NewVirtualClock(driver)
	if err != nil {
		driver.Close()
		return nil, err
	}
	return &ClockedBrowser{driver, clock}, nil
}

func nextFrame(driver selenium.WebDriver) error {
	if browser, ok := driver.(*ClockedBrowser); ok {
		return browser.Advance(16 * time.Millisecond)
	}
	_, err := driver.ExecuteScriptAsync("requestAnimationFrame(arguments[arguments.length - 1]);", nil)
	return err
}

// WaitUntil lets the runner own the deadline. Between observations the browser
// can process the next frame, including callbacks for real I/O.
func WaitUntil(driver selenium.WebDriver, condition selenium.Condition) error {
	for {
		ready, err := condition(driver)
		if err != nil || ready {
			return err
		}
		if err := nextFrame(driver); err != nil {
			return fmt.Errorf("advance to the next frame: %w", err)
		}
	}
}

// Existing callers with an explicit timeout keep their bounded Selenium wait.
func waitFor(driver selenium.WebDriver, condition selenium.Condition, timeout []time.Duration) error {
	if len(timeout) > 0 {
		return driver.WaitWithTimeout(condition, timeout[0])
	}
	return WaitUntil(driver, condition)
}
