package selenium_test

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	"github.com/zemn-me/monorepo/project/me/zemn/testing/browserhelpers"
)

func TestJournalSelectedDayNavigation(t *testing.T) {
	root, err := browserhelpers.FrontendRoot()
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
	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
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
		audio := browserhelpers.TestWAV()
		audio[len(audio)-8] = byte(index + 100)
		path := filepath.Join(t.TempDir(), fmt.Sprintf("selected-day-%02d.wav", index))
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
	if err := browserhelpers.SelectFiles(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", paths, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Local recordings']", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.WaitForNoElement(driver, selenium.ByCSSSelector, "section[aria-label='Local recordings']", 120*time.Second); err != nil {
		browserhelpers.DumpPageDiagnostics(t, driver)
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
			selector := fmt.Sprintf("[role='region'][aria-label='Journal day'] details:has(> summary time[datetime^='%s'])", date.Format("2006-01-02"))
			entry, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, selector, 30*time.Second)
			if err != nil {
				t.Errorf("find cleanup recording %d: %v", index, err)
				continue
			}
			summary, err := entry.FindElement(selenium.ByCSSSelector, ":scope > summary")
			if err != nil {
				t.Error(err)
				continue
			}
			if err := browserhelpers.ClickElementInView(driver, summary); err != nil {
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
			if err := browserhelpers.WaitForNoElement(driver, selenium.ByCSSSelector, selector, 30*time.Second); err != nil {
				t.Errorf("delete cleanup recording %d: %v", index, err)
			}
		}
	}()

	entrySelector := func(index int) string {
		return fmt.Sprintf("[role='region'][aria-label='Journal day'] details:has(> summary time[datetime^='%s'])", dates[index].Format(time.DateOnly))
	}
	assertSelectedDay := func(index int) {
		t.Helper()
		if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, entrySelector(index), 30*time.Second); err != nil {
			t.Fatal(err)
		}
		sections, err := driver.FindElements(selenium.ByCSSSelector, "[role='region'][aria-label='Journal day'] > section")
		if err != nil || len(sections) != 1 {
			t.Fatalf("expected one selected day, got %d: %v", len(sections), err)
		}
		entries, err := driver.FindElements(selenium.ByCSSSelector, "[role='region'][aria-label='Journal day'] details:has(> summary time)")
		if err != nil || len(entries) != 1 {
			t.Fatalf("selected day mounted neighboring recordings: %d %v", len(entries), err)
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
		if err != nil || link.Path != "/journal/day" || at.In(location).Format(time.DateOnly) != dates[index].Format(time.DateOnly) {
			t.Fatalf("selected day lost its linked date: %s %v", address, err)
		}
	}
	visitDay := func(index int) {
		t.Helper()
		root.Path, root.RawQuery = "/journal/day", url.Values{"at": {dates[index].Format(time.RFC3339)}}.Encode()
		if err := driver.Get(root.String()); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(index)
	}
	visitDay(23)
	visitDay(0)

	// A deep link and each navigation must render only the selected day's content.
	for _, width := range []int{1280, 390} {
		if err := driver.ResizeWindow("", width, 900); err != nil {
			t.Fatal(err)
		}
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
			"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": false,
		}); err != nil {
			t.Fatal(err)
		}
		visitDay(6)
		previous, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "a[aria-label='Previous day']", 10*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		if err := previous.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(5)
		if err := driver.Back(); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(6)
		if err := driver.Forward(); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(5)
		next, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "a[aria-label='Next day']", 10*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		if err := next.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(6)
		if err := driver.Refresh(); err != nil {
			t.Fatal(err)
		}
		assertSelectedDay(6)
		if overflow, err := driver.ExecuteScript("return document.documentElement.scrollWidth > innerWidth", nil); err != nil || overflow == true {
			t.Fatalf("selected day overflow at width %d: %v %v", width, overflow, err)
		}
		browserhelpers.SaveNavigationScreenshot(t, driver, fmt.Sprintf("journal-selected-day-%d.png", width))
	}
}
