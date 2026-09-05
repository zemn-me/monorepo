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

func openPark(t testing.TB, schemes ...string) *seleniumutil.Driver {
	t.Helper()
	var ports map[string]string
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		t.Fatal(err)
	}
	port := ports["@@//ts/pulumi/eggsfordogs.com:itest_service"]
	if port == "" {
		port = ports["@@//ts/pulumi/eggsfordogs.com:static_service"]
	}
	if port == "" {
		t.Fatal("park service port was not assigned")
	}
	// SVG gameplay must work even when the browser has no GPU renderer.
	driver, err := seleniumutil.NewWithChromeArguments("--disable-webgl")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = driver.Close() })
	scheme := "light"
	if len(schemes) > 0 {
		scheme = schemes[0]
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setEmulatedMedia", map[string]any{"features": []map[string]string{{"name": "prefers-color-scheme", "value": scheme}}}); err != nil {
		t.Fatal(err)
	}
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

func TestParkFollowsSystemTheme(t *testing.T) {
	for _, initial := range []string{"dark", "light"} {
		t.Run(initial, func(t *testing.T) {
			driver := openPark(t, initial)
			waitFor := func(script string, args ...any) {
				t.Helper()
				if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
					value, err := wd.ExecuteScript(script, args)
					return value == true, err
				}, 30*time.Second); err != nil {
					t.Fatalf("%s: %v", script, err)
				}
			}
			theme := func(scheme string) {
				t.Helper()
				waitFor(`return document.querySelector('main')?.classList.contains('is-night') === arguments[0] && document.querySelector('.masthead button')?.getAttribute('aria-pressed') === String(arguments[0])`, scheme == "dark")
			}
			emulate := func(scheme string) {
				t.Helper()
				if err := driver.ExecuteChromiumCommand("Emulation.setEmulatedMedia", map[string]any{"features": []map[string]string{{"name": "prefers-color-scheme", "value": scheme}}}); err != nil {
					t.Fatal(err)
				}
				waitFor("return matchMedia('(prefers-color-scheme: dark)').matches === arguments[0]", scheme == "dark")
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
			theme(initial)
			click("[aria-label='Pause animation']")
			waitFor("return document.querySelector('.toss-button').disabled")
			const paints = `return [...document.querySelectorAll('.park-scene path:not([display="none"])')].map(p => p.getAttribute('fill')).join(',')`
			before, err := driver.ExecuteScript(paints, nil)
			if err != nil {
				t.Fatal(err)
			}
			opposite := "dark"
			if initial == "dark" {
				opposite = "light"
			}
			emulate(opposite)
			theme(opposite)
			// A paused park must rebuild the SVG scenery as well as changing its controls.
			waitFor(`return [...document.querySelectorAll('.park-scene path:not([display="none"])')].map(p => p.getAttribute('fill')).join(',') !== arguments[0]`, before)
			click(".masthead button")
			theme(initial)
			emulate(initial)
			emulate(opposite)
			// Wait across frames so a queued media-query event cannot escape the assertion.
			if err := driver.SetAsyncScriptTimeout(5 * time.Second); err != nil {
				t.Fatal(err)
			}
			if _, err := driver.ExecuteScriptAsync(`const done = arguments[arguments.length - 1]; requestAnimationFrame(() => requestAnimationFrame(() => done(true)));`, nil); err != nil {
				t.Fatal(err)
			}
			theme(initial)
			if err := driver.Refresh(); err != nil {
				t.Fatal(err)
			}
			waitFor("return document.querySelector('.toss-button')?.disabled === false")
			theme(opposite)
		})
	}
}

// Run explicitly via :park_benchmark; timings are observations, not CI thresholds.
func BenchmarkParkFrames(b *testing.B) {
	driver := openPark(b)
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1200, "height": 800, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		b.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		value, err := wd.ExecuteScript("return document.querySelectorAll('.park-scene path').length > 100", nil)
		return value == true, err
	}, 30*time.Second); err != nil {
		b.Fatal(err)
	}
	if err := driver.SetAsyncScriptTimeout(20 * time.Second); err != nil {
		b.Fatal(err)
	}
	for _, scenario := range []string{"wander", "gather", "orbit"} {
		result, err := driver.ExecuteScriptAsync(`
			const done = arguments[arguments.length - 1], scenario = arguments[0];
			const svg = document.querySelector('svg.park-svg');
			if (scenario === 'gather') [...document.querySelectorAll('.park-toolbar button')].find(button => button.textContent.includes('Call the dogs')).click();
			const intervals = [], updates = []; let last = 0, start = performance.now();
			const observer = new MutationObserver(records => {
				const now = performance.now();
				if (now - start < 1000) { last = now; return; }
				if (last && now - last > 1) { intervals.push(now - last); updates.push(records.length); }
				last = now;
			});
			observer.observe(svg, { attributes: true, childList: true, subtree: true });
			const orbit = scenario === 'orbit' ? setInterval(() => svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true })), 100) : null;
			setTimeout(() => {
				observer.disconnect(); if (orbit) clearInterval(orbit);
				intervals.sort((a,b) => a-b); updates.sort((a,b) => a-b);
				const p = (values, q) => values[Math.floor((values.length - 1) * q)] ?? 0;
				done(JSON.stringify({ scenario, frames: intervals.length, fps: intervals.length * 1000 / intervals.reduce((a,b) => a+b,0), frameP50: p(intervals,.5), frameP95: p(intervals,.95), mutationsP50: p(updates,.5), paths: svg.querySelectorAll('path:not([display="none"])').length, viewport: [innerWidth,innerHeight], webgl: false }));
			}, 6000);
		`, []any{scenario})
		if err != nil {
			b.Fatal(err)
		}
		b.Logf("SVG benchmark: %v", result)
	}
}
