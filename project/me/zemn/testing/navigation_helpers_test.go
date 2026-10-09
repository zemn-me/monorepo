package selenium_test

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

// assertSharedNavigation runs after login with navigation responses delayed by the caller.
func assertSharedNavigation(t *testing.T, driver selenium.WebDriver, publicOrigin string, width int) {
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
	for _, destination := range []struct{ label, selector, path, query string }{
		{"Days", "section[aria-label='Create a journal entry']", "/journal/day", ""},
		{"Wiki", "section[aria-label='Diary wiki']", "/journal", "all"},
	} {
		link, err := driver.FindElement(selenium.ByLinkText, destination.label)
		if err != nil {
			t.Fatal(err)
		}
		if err := link.Click(); err != nil {
			t.Fatal(err)
		}
		if _, err := waitForElement(driver, selenium.ByCSSSelector, pageLoadingSelector, 5*time.Second); err != nil {
			t.Fatalf("%s navigation at width %d gave no loading feedback: %v", destination.label, width, err)
		}
		logoFeedback, err := driver.ExecuteScript(`const header = document.querySelector('header[data-glade-banner]');
const status = header?.querySelector('[role="status"][aria-label="Loading page"]');
const rays = status?.querySelectorAll('svg line');
const rect = status?.getBoundingClientRect();
return rays?.length > 0 && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= header.getBoundingClientRect().bottom && getComputedStyle(status).overflow === 'hidden' && status.querySelector('svg').getBoundingClientRect().height > header.getBoundingClientRect().height && header.querySelector('a[aria-label="Go to homepage"] > svg').getBoundingClientRect().width >= 64;`, nil)
		if err != nil || logoFeedback != true {
			t.Fatalf("loading rays are not visible around the logo at width %d: %v %v", width, logoFeedback, err)
		}
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			fullSize, err := d.ExecuteScript(`const rays = document.querySelectorAll('header [role="status"][aria-label="Loading page"] svg line');
return rays.length > 0 && [...rays].every(ray => Number(ray.getAttribute('x2')) >= 75 && ray.getTotalLength() > 10);`, nil)
			return fullSize == true, err
		}, time.Second); err != nil {
			t.Fatal("loading rays did not grow to full size", err)
		}
		if destination.label == "Days" {
			name := "journal-loading-desktop.png"
			if width == 390 {
				name = "journal-loading-phone.png"
			}
			saveNavigationScreenshot(t, driver, name)
		}
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
		}, time.Second); err != nil {
			t.Fatal("loading rays did not shrink after navigation", err)
		}
		if _, err := waitForElement(driver, selenium.ByCSSSelector, destination.selector, 30*time.Second); err != nil {
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
		assertHeroVideoPreserved(t, driver, video)
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
		link, err := driver.FindElement(selenium.ByCSSSelector, "nav[aria-label='Site navigation'] a[href='"+path+"']")
		if err != nil {
			t.Fatal(err)
		}
		if err := link.Click(); err != nil {
			t.Fatal(err)
		}
		pending, err := waitForElement(driver, selenium.ByCSSSelector, pageLoadingSelector, 5*time.Second)
		if err != nil {
			t.Fatalf("menu navigation to %s at width %d gave no loading feedback: %v", path, width, err)
		}
		if visible, err := pending.IsDisplayed(); err != nil || !visible {
			t.Fatal("page loading feedback is hidden", err)
		}
		contained, err := driver.ExecuteScript(`
const status = document.querySelector('[role="status"][aria-label="Loading page"]');
const bar = status?.closest('header')?.getBoundingClientRect();
const rect = status?.getBoundingClientRect();
return !!bar && rect.left >= bar.left && rect.right <= bar.right && rect.top >= bar.top && rect.bottom <= bar.bottom;
`, nil)
		if err != nil || contained != true {
			t.Fatalf("loading feedback escaped the navigation bar: %v %v", contained, err)
		}
		if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
			current, err := d.CurrentURL()
			return current == publicOrigin+path, err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		assertHeroVideoPreserved(t, driver, video)
		if path == "/" {
			homeLayout, err := driver.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]');
const rect = bar.getBoundingClientRect();
const hero = document.querySelector('figure').getBoundingClientRect();
const card = document.querySelector('[data-glade-banner] > a[aria-label="Go to homepage"]');
const menu = bar.querySelector('summary').getBoundingClientRect();
return rect.top === 0 && Math.abs(rect.left - hero.left) < 1 && Math.abs(rect.right - hero.right) < 1 && rect.height < 100 && !bar.querySelector('a[aria-label="Go to homepage"]') && !!card && card.textContent.includes('Thomas') && getComputedStyle(document.querySelector('figure')).display !== 'none' && menu.width >= 44 && menu.height >= 44 && !!bar.querySelector('button[aria-label="Go back"]');`, nil)
			if err != nil || homeLayout != true {
				t.Fatalf("homepage does not keep its card and shared top bar at width %d: %v %v", width, homeLayout, err)
			}
			saveNavigationScreenshot(t, driver, fmt.Sprintf("homepage-topbar-%d.png", width))
		}
		if path == "/article" {
			back, err := waitForElement(driver, selenium.ByCSSSelector, "button[aria-label='Go back']", 10*time.Second)
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
	wikiLink, err := driver.FindElement(selenium.ByLinkText, "Wiki")
	if err != nil {
		t.Fatal(err)
	}
	if err := wikiLink.Click(); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
}

func assertHeroVideoPreserved(t *testing.T, driver selenium.WebDriver, video selenium.WebElement) {
	t.Helper()
	preserved, err := driver.ExecuteScript(`return arguments[0] === document.querySelector('figure video');`, []interface{}{video})
	if err != nil || preserved != true {
		t.Fatalf("navigation replaced the hero video: %v %v", preserved, err)
	}
}

func saveNavigationScreenshot(t *testing.T, driver selenium.WebDriver, name string) {
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
