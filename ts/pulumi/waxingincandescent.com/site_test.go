package waxingincandescent_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bazelbuild/rules_go/go/runfiles"
	webdriver "github.com/tebeka/selenium"

	selenium "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestHomepage(t *testing.T) {
	build, err := runfiles.Rlocation("monorepo/ts/pulumi/waxingincandescent.com/build")
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.FileServer(http.Dir(build)))
	defer server.Close()

	driver, err := selenium.NewWithChromeArguments("--disable-webgl")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.SetAsyncScriptTimeout(5 * time.Second); err != nil {
		t.Fatal(err)
	}
	waitFor := func(script string, args ...any) {
		t.Helper()
		if err := driver.WaitWithTimeout(func(wd webdriver.WebDriver) (bool, error) {
			value, err := wd.ExecuteScript(script, args)
			return value == true, err
		}, 30*time.Second); err != nil {
			t.Fatalf("%s: %v", script, err)
		}
	}
	const geometry = `return [...document.querySelectorAll('.hangar-background path')].map(p => p.getAttribute('d')).join('')`
	readGeometry := func() any {
		t.Helper()
		value, err := driver.ExecuteScript(geometry, nil)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	assertStill := func() {
		t.Helper()
		value, err := driver.ExecuteScriptAsync(`
			const done = arguments[arguments.length - 1];
			requestAnimationFrame(() => requestAnimationFrame(() => {
				const svg = document.querySelector('.hangar-background');
				const before = svg.innerHTML;
				setTimeout(() => done(before === svg.innerHTML), 350);
			}));
		`, nil)
		if err != nil || value != true {
			t.Fatalf("expected stationary wireframe: %v, %v", value, err)
		}
	}
	setMotion := func(value string) {
		t.Helper()
		if err := driver.ExecuteChromiumCommand("Emulation.setEmulatedMedia", map[string]any{"features": []map[string]string{{"name": "prefers-reduced-motion", "value": value}}}); err != nil {
			t.Fatal(err)
		}
	}
	setMotion("no-preference")

	for _, size := range []struct {
		name          string
		width, height int
	}{
		{"desktop", 1440, 900},
		{"mobile", 390, 844},
	} {
		t.Run(size.name, func(t *testing.T) {
			if err := driver.ResizeWindow("", size.width, size.height); err != nil {
				t.Fatal(err)
			}
			if err := driver.Get(server.URL); err != nil {
				t.Fatal(err)
			}
			waitFor(`return !!document.querySelector('.hangar-background path[d^="M"]')`)
			result, err := driver.ExecuteScript(`
				const heading = document.querySelector('main h1');
				if (!heading) return 'missing heading';
				if (heading.textContent !== 'WAXING INCANDESCENT') return heading.textContent;
				const bounds = heading.getBoundingClientRect();
				if (Math.abs(bounds.x + bounds.width / 2 - innerWidth / 2) > 2) return 'not horizontally centered';
				if (Math.abs(bounds.y + bounds.height / 2 - innerHeight / 2) > 2) return 'not vertically centered';
				if (document.documentElement.scrollWidth > innerWidth) return 'horizontal overflow';
				const svg = document.querySelector('.hangar-background');
				if (svg.getAttribute('aria-hidden') !== 'true') return 'decorative scene is exposed to assistive technology';
				if (getComputedStyle(svg).pointerEvents !== 'none') return 'scene intercepts pointer events';
				if (Number(getComputedStyle(heading).zIndex) <= 0) return 'heading is not above the scene';
				if (document.querySelector('canvas')) return 'unexpected canvas renderer';
				const box = svg.querySelector('g').getBBox();
				if (box.width < innerWidth * 0.25 || box.height < 50) return 'wireframe is too small or empty';
				if (box.x < 0 || box.x + box.width > innerWidth || box.y < 0 || box.y + box.height > innerHeight) return 'wireframe clipped';
				if ([...svg.querySelectorAll('path')].some(p => /NaN|Infinity/.test(p.getAttribute('d')))) return 'invalid geometry';
				return document.title === 'WAXING INCANDESCENT' ? 'ok' : 'incorrect title';
			`, nil)
			if err != nil {
				t.Fatal(err)
			}
			if result != "ok" {
				t.Fatalf("homepage: %v", result)
			}
			waitFor(geometry+` !== arguments[0]`, readGeometry())
			pause, err := driver.FindElement(webdriver.ByCSSSelector, `[aria-label="Pause level rotation"]`)
			if err != nil {
				t.Fatal(err)
			}
			if err := pause.Click(); err != nil {
				t.Fatal(err)
			}
			waitFor(`return !!document.querySelector('[aria-label="Resume level rotation"]')`)
			assertStill()
			if err := pause.Click(); err != nil {
				t.Fatal(err)
			}
			waitFor(geometry+` !== arguments[0]`, readGeometry())
			setMotion("reduce")
			waitFor(`return !document.querySelector('.motion-toggle')`)
			assertStill()
			// The preference must be respected on first load as well as live changes.
			if err := driver.Refresh(); err != nil {
				t.Fatal(err)
			}
			waitFor(`return !!document.querySelector('.hangar-background path[d^="M"]') && !document.querySelector('.motion-toggle')`)
			assertStill()
			beforeResize := readGeometry()
			if err := driver.ResizeWindow("", size.width-40, size.height-40); err != nil {
				t.Fatal(err)
			}
			waitFor(geometry+` !== arguments[0]`, beforeResize)
			assertStill()
			setMotion("no-preference")
			waitFor(geometry+` !== arguments[0]`, readGeometry())
		})
	}
}
