package browserhelpers

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tebeka/selenium"
)

const pageLoadingSelector = "[role='status'][aria-label='Loading page']"

// AssertSharedNavigation checks pending and completed navigations after login.
func AssertSharedNavigation(t *testing.T, driver selenium.WebDriver, publicOrigin string, width int, withNavigationPaused func(func())) {
	t.Helper()
	compact, err := driver.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]').getBoundingClientRect();
const heading = document.querySelector('h1').getBoundingClientRect();
return bar.top >= 0 && bar.height < 100 && heading.top >= bar.bottom && heading.bottom < window.innerHeight && getComputedStyle(document.querySelector('figure')).display === 'none';`, nil)
	if err != nil || compact != true {
		t.Fatalf("non-homepage content starts behind the hero at width %d: %v %v", width, compact, err)
	}
	video, err := driver.FindElement(selenium.ByCSSSelector, "figure video")
	if err != nil {
		t.Fatal(err)
	}
	checkLoading := func(linkSelector, destination, script string) {
		t.Helper()
		if err := ClickElementWithRetry(driver, selenium.ByCSSSelector, linkSelector, 10*time.Second); err != nil {
			t.Fatal(err)
		}
		var observed any
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			var err error
			observed, err = d.ExecuteScript(script, []any{pageLoadingSelector})
			return observed == true, err
		}, 10*time.Second); err != nil {
			t.Fatalf("%s loading feedback at width %d: %v (%v)", destination, width, observed, err)
		}
	}
	for _, destination := range []struct{ label, linkSelector, selector, path, query string }{
		{"Overview", "h1 a[href='/journal']", "nav[aria-label='Choose journal date']", "/journal", ""},
		{"Day", "a[aria-current='date']", "section[aria-label='Create a journal entry']", "/journal/day", ""},
		{"Wiki", "nav[aria-label='Browse journal'] a[href='/journal?wiki=all']", "section[aria-label='Diary wiki']", "/journal", "all"},
	} {
		if destination.label != "Overview" {
			OpenJournalDatePicker(t, driver)
		}
		withNavigationPaused(func() {
			checkLoading(destination.linkSelector, destination.label, `const status = document.querySelector(arguments[0]);
if (!status) return 'no loading status';
const header = status.closest('header');
const rect = status.getBoundingClientRect();
const bar = header.getBoundingClientRect();
const rayHeight = status.querySelector('svg')?.getBoundingClientRect().height;
const logoWidth = header.querySelector('a[aria-label="Go to homepage"] > svg')?.getBoundingClientRect().width;
const rays = [...status.querySelectorAll('svg line')];
const grown = rays.length > 0 && rays.every(ray => Number(ray.getAttribute('x2')) >= 75 && ray.getTotalLength() > 10);
const overflow = getComputedStyle(status).overflow;
if (grown && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= bar.bottom && overflow === 'hidden' && rayHeight > bar.height && logoWidth >= 64) return true;
return {grown, rays: rays.length, status: rect.toJSON(), bar: bar.toJSON(), rayHeight, logoWidth, overflow};`)
			if destination.label == "Day" {
				name := "journal-loading-desktop.png"
				if width == 390 {
					name = "journal-loading-phone.png"
				}
				SaveNavigationScreenshot(t, driver, name)
			}
		})
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			pending, err := d.FindElements(selenium.ByCSSSelector, pageLoadingSelector)
			return len(pending) == 0, err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			shrunk, err := d.ExecuteScript(`const rays = document.querySelectorAll('header [aria-label="Loading page"][aria-hidden="true"] svg line');
return rays.length > 0 && [...rays].every(ray => ray.getTotalLength() <= 0.01);`, nil)
			return shrunk == true, err
		}, 10*time.Second); err != nil {
			t.Fatal("loading rays did not shrink after navigation", err)
		}
		if _, err := WaitForElement(driver, selenium.ByCSSSelector, destination.selector, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		currentURL, err := driver.CurrentURL()
		if err != nil {
			t.Fatal(err)
		}
		current, err := url.Parse(currentURL)
		if err != nil || current.Path != destination.path || current.Query().Get("wiki") != destination.query {
			t.Fatalf("%s did not reach its destination: %s (%v)", destination.label, currentURL, err)
		}
		AssertJournalNavigationAtTop(t, driver, destination.path)
		AssertHeroVideoPreserved(t, driver, video)
		loggedIn, err := driver.FindElement(selenium.ByCSSSelector, "[data-glade-footer] button[aria-label='Log out']")
		if err != nil {
			t.Fatal("navigation lost the signed-in session", err)
		}
		if visible, err := loggedIn.IsDisplayed(); err != nil || !visible {
			t.Fatal("navigation hid the signed-in session", err)
		}
	}
	for _, path := range []string{"/article", "/experiments", "/", "/article", "/journal"} {
		previousURL, err := driver.CurrentURL()
		if err != nil {
			t.Fatal(err)
		}
		menu, err := driver.FindElement(selenium.ByCSSSelector, "summary[aria-label='Open navigation menu']")
		if err != nil {
			t.Fatal(err)
		}
		if err := menu.Click(); err != nil {
			t.Fatal(err)
		}
		withNavigationPaused(func() {
			checkLoading("nav[aria-label='Site navigation'] a[href='"+path+"']", path, `
const status = document.querySelector(arguments[0]);
if (!status?.checkVisibility({opacityProperty: true, visibilityProperty: true})) return 'loading status hidden';
const bar = status.closest('header').getBoundingClientRect();
const rect = status.getBoundingClientRect();
return rect.width > 0 && rect.height > 0 && rect.left >= bar.left && rect.right <= bar.right && rect.top >= bar.top && rect.bottom <= bar.bottom;`)
		})
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			current, err := d.CurrentURL()
			return current == publicOrigin+path, err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		AssertHeroVideoPreserved(t, driver, video)
		if path == "/" {
			// The URL can change before the homepage layout and scroll reset commit.
			var homeLayout any
			err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
				var err error
				homeLayout, err = d.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]');
const rect = bar.getBoundingClientRect();
const hero = document.querySelector('figure').getBoundingClientRect();
const card = document.querySelector('[data-glade-banner] > a[aria-label="Go to homepage"]');
const menu = bar.querySelector('summary').getBoundingClientRect();
return rect.top === 0 && Math.abs(rect.left - hero.left) < 1 && Math.abs(rect.right - hero.right) < 1 && rect.height < 100 && !bar.querySelector('a[aria-label="Go to homepage"]') && !!card && card.textContent.includes('Thomas') && getComputedStyle(document.querySelector('figure')).display !== 'none' && menu.width >= 44 && menu.height >= 44 && !!bar.querySelector('button[aria-label="Go back"]');`, nil)
				return homeLayout == true, err
			}, 10*time.Second)
			if err != nil {
				t.Fatalf("homepage does not keep its card and shared top bar at width %d: %v %v", width, homeLayout, err)
			}
			SaveNavigationScreenshot(t, driver, fmt.Sprintf("homepage-topbar-%d.png", width))
		}
		if path == "/article" {
			back, err := WaitForElement(driver, selenium.ByCSSSelector, "button[aria-label='Go back']", 10*time.Second)
			if err != nil {
				t.Fatal(err)
			}
			if err := back.Click(); err != nil {
				t.Fatal(err)
			}
			if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
				current, err := d.CurrentURL()
				return current == previousURL, err
			}, 30*time.Second); err != nil {
				t.Fatal("top bar did not go back", err)
			}
		}
	}
	ClickJournalWiki(t, driver)
	if _, err := WaitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
}

func AssertHeroVideoPreserved(t *testing.T, driver selenium.WebDriver, video selenium.WebElement) {
	t.Helper()
	preserved, err := driver.ExecuteScript(`return arguments[0] === document.querySelector('figure video');`, []interface{}{video})
	if err != nil || preserved != true {
		t.Fatalf("navigation replaced the hero video: %v %v", preserved, err)
	}
}

func SaveNavigationScreenshot(t *testing.T, driver selenium.WebDriver, name string) {
	t.Helper()
	output := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
	if output == "" {
		return
	}
	shot, err := driver.Screenshot()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(output, name), shot, 0o600); err != nil {
		t.Fatal(err)
	}
}

func AssertJournalNavigationAtTop(t *testing.T, driver selenium.WebDriver, path string) {
	t.Helper()
	// Scroll restoration and font layout can land on different rendering frames.
	if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		atTop, err := d.ExecuteScriptAsync(`
const [path, done] = arguments;
const atTop = () => location.pathname === path && scrollY <= 1;
if (!atTop()) { done(false); return; }
document.fonts.ready.then(() => requestAnimationFrame(() => {
	if (!atTop()) { done(false); return; }
	requestAnimationFrame(() => done(atTop()));
}));`, []any{path})
		return atTop == true, err
	}, 10*time.Second); err != nil {
		t.Fatalf("journal navigation to %s did not stay at the top: %v", path, err)
	}
}

// OpenJournalDatePicker exposes the calendar's date and view links through the UI.
func OpenJournalDatePicker(t *testing.T, driver selenium.WebDriver) {
	t.Helper()
	picker, err := WaitForElement(driver, selenium.ByCSSSelector, "summary[aria-label='Choose journal date']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	open, err := driver.ExecuteScript("return arguments[0].parentElement.open", []any{picker})
	if err != nil {
		t.Fatal(err)
	}
	if open != true {
		if err := ClickElementInView(driver, picker); err != nil {
			t.Fatal(err)
		}
	}
}

// ClickJournalWiki handles both the loading toolbar and the loaded calendar menu.
func ClickJournalWiki(t *testing.T, driver selenium.WebDriver) {
	t.Helper()
	if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		links, err := d.FindElements(selenium.ByCSSSelector, "a[href='/journal?wiki=all']")
		if err != nil {
			return false, err
		}
		for _, link := range links {
			visible, err := link.IsDisplayed()
			if IsStaleElementErr(err) {
				return false, nil
			}
			if err != nil {
				return false, err
			}
			if !visible {
				continue
			}
			err = ClickElementInView(d, link)
			if IsStaleElementErr(err) {
				return false, nil
			}
			return err == nil, err
		}
		pickers, err := d.FindElements(selenium.ByCSSSelector, "summary[aria-label='Choose journal date']")
		if err != nil || len(pickers) == 0 {
			return false, err
		}
		open, err := d.ExecuteScript("return arguments[0].parentElement.open", []any{pickers[0]})
		if IsStaleElementErr(err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if open != true {
			err = ClickElementInView(d, pickers[0])
			if IsStaleElementErr(err) {
				return false, nil
			}
		}
		return false, err
	}, 30*time.Second); err != nil {
		t.Fatal("open journal wiki: ", err)
	}
}
