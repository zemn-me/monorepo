package selenium_test

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestJournalDayPagination(t *testing.T) {
	root, err := frontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeArguments("--force-device-scale-factor=1")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.SetTimezoneOverride("America/Los_Angeles"); err != nil {
		t.Fatal(err)
	}
	root.Path = "/journal"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}

	// Import distinct dated recordings through the same file picker as a user.
	location, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	var dates []time.Time
	for index := range 24 {
		audio := testWAV()
		audio[len(audio)-8] = byte(index + 100)
		path := filepath.Join(t.TempDir(), fmt.Sprintf("pagination-%02d.wav", index))
		if err := os.WriteFile(path, audio, 0600); err != nil {
			t.Fatal(err)
		}
		date := time.Date(2010, time.January, index+1, 12, 0, 0, 0, location)
		if err := os.Chtimes(path, date, date); err != nil {
			t.Fatal(err)
		}
		paths = append(paths, path)
		dates = append(dates, date)
	}
	input, err := waitForElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := input.SendKeys(strings.Join(paths, "\n")); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Local recordings']", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := waitForNoElement(driver, selenium.ByCSSSelector, "section[aria-label='Local recordings']", 120*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatal(err)
	}

	defer func() {
		for index, date := range dates {
			cleanupURL := root
			cleanupURL.Path, cleanupURL.RawQuery = "/journal/day", url.Values{"at": {date.Format(time.RFC3339)}}.Encode()
			if err := driver.Get(cleanupURL.String()); err != nil {
				t.Errorf("open cleanup day %d: %v", index, err)
				continue
			}
			selector := fmt.Sprintf("[role='region'][aria-label='Journal days'] > section:has(> h3 > time[datetime^='%s']) details[id^='entry-']", date.Format("2006-01-02"))
			entry, err := waitForElement(driver, selenium.ByCSSSelector, selector, 30*time.Second)
			if err != nil {
				t.Errorf("find cleanup recording %d: %v", index, err)
				continue
			}
			summary, err := entry.FindElement(selenium.ByCSSSelector, ":scope > summary")
			if err != nil {
				t.Error(err)
				continue
			}
			if err := clickElementInView(driver, summary); err != nil {
				t.Error(err)
				continue
			}
			remove, err := entry.FindElement(selenium.ByCSSSelector, "[role='slider'][aria-label='Swipe to delete journal entry']")
			if err != nil {
				t.Error(err)
				continue
			}
			if err := remove.SendKeys(selenium.EndKey + selenium.EnterKey); err != nil {
				t.Error(err)
				continue
			}
			if err := waitForNoElement(driver, selenium.ByCSSSelector, selector, 30*time.Second); err != nil {
				t.Errorf("delete cleanup recording %d: %v", index, err)
			}
		}
	}()

	daySelector := func(index int) string {
		return fmt.Sprintf("[role='region'][aria-label='Journal days'] > section:has(> h3 > time[datetime^='%s'])", dates[index].Format("2006-01-02"))
	}
	visitDay := func(index int) {
		t.Helper()
		root.Path, root.RawQuery = "/journal/day", url.Values{"at": {dates[index].Format(time.RFC3339)}}.Encode()
		if err := driver.Get(root.String()); err != nil {
			t.Fatal(err)
		}
		if _, err := waitForElement(driver, selenium.ByCSSSelector, daySelector(index), 30*time.Second); err != nil {
			t.Fatal(err)
		}
	}
	assertDayCount := func(want int) {
		t.Helper()
		if err := driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
			days, err := webDriver.FindElements(selenium.ByCSSSelector, "[role='region'][aria-label='Journal days'] > section")
			return len(days) == want, err
		}, 10*time.Second); err != nil {
			t.Fatalf("rendered day count did not reach %d: %v", want, err)
		}
	}
	visitDay(23)
	assertDayCount(7)
	if days, err := driver.FindElements(selenium.ByCSSSelector, daySelector(0)); err != nil || len(days) != 0 {
		t.Fatalf("oldest day was eagerly rendered: %v %v", len(days), err)
	}
	for _, want := range []int{14, 21, 24} {
		older, err := waitForElement(driver, selenium.ByXPATH, "//button[normalize-space()='Show older days']", 10*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := driver.ExecuteScript("arguments[0].scrollIntoView({block:'center',behavior:'instant'})", []any{older}); err != nil {
			t.Fatal(err)
		}
		assertDayCount(want)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, daySelector(0), 10*time.Second); err != nil {
		t.Fatal("scrolling did not reach oldest day: ", err)
	}
	if err := waitForNoElement(driver, selenium.ByXPATH, "//button[normalize-space()='Show older days']", 10*time.Second); err != nil {
		t.Fatal("older-day control remained at end of journal: ", err)
	}

	// A deep link must not mount all the newer days to reach its destination.
	for _, width := range []int{1280, 390} {
		if err := driver.ResizeWindow("", width, 900); err != nil {
			t.Fatal(err)
		}
		// Chromium's minimum outer window width exceeds a narrow phone.
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
			"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": false,
		}); err != nil {
			t.Fatal(err)
		}
		visitDay(6)
		assertDayCount(7)
		day, err := driver.FindElement(selenium.ByCSSSelector, daySelector(6))
		if err != nil {
			t.Fatal(err)
		}
		position, err := driver.ExecuteScript("return arguments[0].getBoundingClientRect().top", []any{day})
		if err != nil {
			t.Fatal(err)
		}
		newer, err := driver.FindElement(selenium.ByXPATH, "//button[normalize-space()='Show newer days']")
		if err != nil {
			t.Fatal(err)
		}
		address, err := driver.CurrentURL()
		if err != nil {
			t.Fatal(err)
		}
		link, err := url.Parse(address)
		if err != nil {
			t.Fatal(err)
		}
		at, err := time.Parse(time.RFC3339Nano, link.Query().Get("at"))
		if err != nil || at.In(location).Format(time.DateOnly) != dates[6].Format(time.DateOnly) {
			t.Fatalf("opening a day changed its linked date: %s %v", address, err)
		}
		// Reach the control by keyboard without scrolling the reading position.
		if _, err := driver.ExecuteScript("arguments[0].focus({preventScroll:true})", []any{newer}); err != nil {
			t.Fatal(err)
		}
		saveNavigationScreenshot(t, driver, fmt.Sprintf("journal-pagination-focus-%d.png", width))
		if err := newer.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		assertDayCount(14)
		// Let browser scroll anchoring and the scroll-updated URL settle.
		if _, err := driver.ExecuteScriptAsync("setTimeout(arguments[arguments.length - 1], 350)", nil); err != nil {
			t.Fatal(err)
		}
		stable, err := driver.ExecuteScript("return Math.abs(arguments[0].getBoundingClientRect().top - arguments[1]) < 2", []any{day, position})
		if err != nil || stable != true {
			t.Fatalf("prepending newer days moved the reading position at width %d: %v %v", width, stable, err)
		}
		if overflow, err := driver.ExecuteScript("return document.documentElement.scrollWidth > innerWidth", nil); err != nil || overflow == true {
			t.Fatalf("pagination overflow at width %d: %v %v", width, overflow, err)
		}
		saveNavigationScreenshot(t, driver, fmt.Sprintf("journal-pagination-%d.png", width))

		// The address tracks the day at the viewport's center after scrolling.
		address, err = driver.CurrentURL()
		if err != nil {
			t.Fatal(err)
		}
		link, err = url.Parse(address)
		if err != nil {
			t.Fatal(err)
		}
		at, err = time.Parse(time.RFC3339Nano, link.Query().Get("at"))
		if err != nil {
			t.Fatalf("scrolling did not retain a shareable date: %v", err)
		}
		focusedDay := -1
		for index, date := range dates {
			if at.In(location).Format(time.DateOnly) == date.Format(time.DateOnly) {
				focusedDay = index
				break
			}
		}
		if focusedDay < 0 {
			t.Fatalf("scrolling selected a day outside the rendered recordings: %s", address)
		}
		if err := driver.Refresh(); err != nil {
			t.Fatal(err)
		}
		if _, err := waitForElement(driver, selenium.ByCSSSelector, daySelector(focusedDay), 30*time.Second); err != nil {
			t.Fatalf("reloaded day link lost its destination (%s): %v", address, err)
		}
		if newer, err := driver.FindElements(selenium.ByCSSSelector, daySelector(23)); err != nil || len(newer) != 0 {
			t.Fatalf("reloading eagerly rendered the newer history: %v %v", len(newer), err)
		}
	}
}
