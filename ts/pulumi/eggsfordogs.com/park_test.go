package eggsfordogs_test

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func openPark(t *testing.T) *seleniumutil.Driver {
	t.Helper()
	var ports map[string]string
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		t.Fatal(err)
	}
	port := ports["@@//ts/pulumi/eggsfordogs.com:itest_service"]
	if port == "" {
		t.Fatal("park service port was not assigned")
	}
	// SVG gameplay must work even when the browser has no GPU renderer.
	driver, err := seleniumutil.NewWithChromeArguments("--disable-webgl")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = driver.Close() })
	if err := driver.Get(fmt.Sprintf("http://localhost:%s", port)); err != nil {
		t.Fatal(err)
	}
	return driver
}

func TestParkPlayAndAccessibleControls(t *testing.T) {
	driver := openPark(t)
	waitFor := func(script string) {
		t.Helper()
		if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			value, err := wd.ExecuteScript(script, nil)
			return value == true, err
		}, 30*time.Second); err != nil {
			body, _ := driver.ExecuteScript("return document.body.innerText", nil)
			logs, _ := driver.Log(log.Browser)
			t.Fatalf("%s: %v; page: %v; logs: %+v", script, err, body, logs)
		}
	}
	click := func(selector string) {
		t.Helper()
		element, err := driver.FindElement(selenium.ByCSSSelector, selector)
		if err != nil {
			t.Fatal(err)
		}
		if err := element.Click(); err != nil {
			t.Fatal(err)
		}
	}
	waitFor("return document.querySelector('.toss-button')?.disabled === false")
	waitFor("return !document.querySelector('canvas') && document.querySelectorAll('svg.park-svg .park-scene path').length > 100")
	click(".toss-button")
	waitFor("return document.querySelector('.egg-count strong')?.textContent === '1'")
	click("[aria-label='Pause animation']")
	waitFor("return document.querySelector('.toss-button').disabled && !!document.querySelector('[aria-label=\"Play animation\"]')")
	click("[aria-label='Play animation']")
	click("[aria-label='Switch to moonlight']")
	waitFor("return document.querySelector('main').classList.contains('is-night')")
	click(".pack-link")
	waitFor("return document.querySelectorAll('#pack-list article').length === 6")
	click("[aria-label='Close pack']")
	scene, err := driver.FindElement(selenium.ByCSSSelector, "svg.park-svg")
	if err != nil {
		t.Fatal(err)
	}
	if err := scene.SendKeys(" "); err != nil {
		t.Fatal(err)
	}
	waitFor("return document.querySelector('.egg-count strong')?.textContent === '2'")
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": true}); err != nil {
		t.Fatal(err)
	}
	waitFor("return document.documentElement.scrollWidth <= window.innerWidth")
	if err := driver.ExecuteChromiumCommand("Emulation.setEmulatedMedia", map[string]any{"features": []map[string]string{{"name": "prefers-reduced-motion", "value": "reduce"}}}); err != nil {
		t.Fatal(err)
	}
	waitFor("return document.querySelector('.toss-button').disabled && !!document.querySelector('[aria-label=\"Play animation\"]')")
	click("[aria-label='Play animation']")
	waitFor("return document.querySelector('.toss-button').disabled === false")
}
