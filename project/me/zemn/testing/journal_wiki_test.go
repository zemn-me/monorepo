package selenium_test

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

// The fictional corpus is a local API fixture. Production bundles deliberately
// omit the development button that invokes this endpoint in local previews.
var seedJournalWikiFixture = sync.OnceValue(func() error {
	api, err := apiRoot()
	if err != nil {
		return err
	}
	client := http.Client{Timeout: 90 * time.Second}
	response, err := client.Post(api.String()+"/__local/journal/seed", "application/json", nil)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("seed wiki fixture: %s: %s", response.Status, body)
	}
	return nil
})

func TestJournalWikiNavigationAndCitations(t *testing.T) {
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := frontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeArguments()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.ResizeWindow("", 390, 900); err != nil {
		t.Fatal(err)
	}
	var originalVideo selenium.WebElement
	assertWikiNavigation := func() {
		t.Helper()
		assertHeroVideoPreserved(t, driver, originalVideo)
		visible, err := driver.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]').getBoundingClientRect(); return bar.top >= 0 && bar.bottom <= window.innerHeight && bar.height < 100;`, nil)
		if err != nil || visible != true {
			t.Fatalf("wiki navigation hid the compact navigation bar: %v %v", visible, err)
		}
	}
	root.Path = "/journal"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	originalVideo, err = driver.FindElement(selenium.ByCSSSelector, "figure video")
	if err != nil {
		t.Fatal(err)
	}
	if err := clickElementWithRetry(driver, selenium.ByLinkText, "Wiki", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	search, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input[type='search']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	assertWikiNavigation()
	if err := search.SendKeys("Maya"); err != nil {
		t.Fatal(err)
	}
	page, err := waitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//a[strong[normalize-space()='Maya']]", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := search.SendKeys(selenium.TabKey); err != nil {
		t.Fatal(err)
	}
	focused, err := driver.ExecuteScript(`return document.activeElement?.textContent?.includes('Maya');`, nil)
	if err != nil || focused != true {
		t.Fatalf("wiki page is not keyboard reachable: %v %v", focused, err)
	}
	if err := page.SendKeys(selenium.EnterKey); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//h3[normalize-space()='Maya']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	assertWikiNavigation()
	for _, step := range []struct {
		link, destination string
	}{
		{"//section[@aria-label='Diary wiki']//article//a[normalize-space()='Lantern']", "//section[@aria-label='Diary wiki']//h3[normalize-space()='Lantern']"},
		{"//section[@aria-label='Diary wiki']//h2/a[normalize-space()='Wiki']", "//section[@aria-label='Diary wiki']//input[@type='search']"},
		{"//section[@aria-label='Diary wiki']//a[strong[normalize-space()='Maya']]", "//section[@aria-label='Diary wiki']//h3[normalize-space()='Maya']"},
	} {
		link, err := waitForElement(driver, selenium.ByXPATH, step.link, 30*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		if err := link.Click(); err != nil {
			t.Fatal(err)
		}
		if _, err := waitForElement(driver, selenium.ByXPATH, step.destination, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		assertWikiNavigation()
	}
	for _, width := range []int{1280, 390} {
		if err := driver.ResizeWindow("", width, 900); err != nil {
			t.Fatal(err)
		}
		if _, err := driver.ExecuteScript(`document.querySelector('section[aria-label="Diary wiki"]').scrollIntoView({block: 'center'});`, nil); err != nil {
			t.Fatal(err)
		}
		if _, err := driver.FindElement(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] a[href*='entry=']"); err != nil {
			t.Fatal("wiki lacks source audio links: ", err)
		}
		overflow, err := driver.ExecuteScript(`return document.documentElement.scrollWidth > window.innerWidth;`, nil)
		if err != nil || overflow == true {
			t.Fatalf("wiki overflow at %d: %v %v", width, overflow, err)
		}
		if directory := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); directory != "" {
			screenshot, err := driver.Screenshot()
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(directory, fmt.Sprintf("journal-wiki-%d.png", width)), screenshot, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	// Follow an inline citation as a user would, through the footnote preview.
	reference, err := driver.FindElement(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] a[aria-label^='Play source']")
	if err != nil {
		t.Fatal(err)
	}
	if err := reference.Click(); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "audio", 30*time.Second); err != nil {
		t.Fatal("citation did not open source audio: ", err)
	}
	root.Path, root.RawQuery = "/journal", "wiki=00000000-0000-0000-0000-000000000000"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//*[@role='status' and contains(.,'unavailable')]", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := driver.ExecuteScript(`document.querySelector('section[aria-label="Diary wiki"]').scrollIntoView({block: 'center'});`, nil); err != nil {
		t.Fatal(err)
	}
	if directory := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); directory != "" {
		screenshot, err := driver.Screenshot()
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(directory, "journal-wiki-unavailable.png"), screenshot, 0600); err != nil {
			t.Fatal(err)
		}
	}
}

// These screenshots use authored fictional content through the normal local
// sample-data flow, so UI reviews do not require a paid model or private diary.
func TestJournalReviewScreenshots(t *testing.T) {
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := frontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeArguments("--force-device-scale-factor=1")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	defer func() {
		if !t.Failed() {
			return
		}
		if page, err := driver.FindElement(selenium.ByTagName, "body"); err == nil {
			if content, err := page.Text(); err == nil {
				t.Log(content)
			}
		}
		if shot, err := driver.Screenshot(); err == nil {
			_ = os.WriteFile(filepath.Join(os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"), "review-failure.png"), shot, 0600)
		}
	}()
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
	find := func(by, selector string) selenium.WebElement {
		t.Helper()
		el, err := waitForElement(driver, by, selector, 30*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		return el
	}
	click := func(by, selector string) {
		t.Helper()
		if err := clickElementWithRetry(driver, by, selector, 30*time.Second); err != nil {
			t.Fatal(err)
		}
	}
	save := func(name string, data []byte) {
		t.Helper()
		directory := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
		if directory == "" {
			t.Fatal("screenshots require TEST_UNDECLARED_OUTPUTS_DIR")
		}
		if err := os.WriteFile(filepath.Join(directory, name+".png"), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	capture := func(name, selector string, width, height int, elementOnly bool) {
		t.Helper()
		if err := driver.ResizeWindow("", width, height); err != nil {
			t.Fatal(err)
		}
		el := find(selenium.ByCSSSelector, selector)
		if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block:'start', behavior:'instant'}); window.scrollBy(0,-90);`, []any{el}); err != nil {
			t.Fatal(err)
		}
		if overflow, err := driver.ExecuteScript(`return document.documentElement.scrollWidth > innerWidth`, nil); err != nil || overflow == true {
			t.Fatalf("overflow in %s: %v %v", name, overflow, err)
		}
		var data []byte
		var err error
		if elementOnly {
			data, err = el.Screenshot(false)
		} else {
			data, err = driver.Screenshot()
		}
		if err != nil {
			t.Fatal(err)
		}
		save(name, data)
	}
	click(selenium.ByLinkText, "Wiki")
	find(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input")
	click(selenium.ByLinkText, "Overview")
	capture("01-overview-desktop", "section[aria-labelledby='recent-journal-entries']", 1440, 1000, false)
	click(selenium.ByLinkText, "Wiki")
	find(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input")
	capture("02-wiki-index-desktop", "section[aria-label='Diary wiki']", 1440, 1000, true)
	openPage := func(title string) {
		t.Helper()
		click(selenium.ByLinkText, "Wiki")
		click(selenium.ByXPATH, "//section[@aria-label='Diary wiki']//a[strong[normalize-space()='"+title+"']]")
		find(selenium.ByXPATH, "//section[@aria-label='Diary wiki']//h3[normalize-space()='"+title+"']")
	}
	for _, page := range []struct{ name, title string }{
		{"03-wiki-maya-desktop", "Maya"},
		{"04-wiki-lantern-desktop", "Lantern"},
		{"05-wiki-attention-desktop", "Attention budget"},
		{"06-wiki-library-desktop", "Rivermill Library"},
	} {
		openPage(page.title)
		entity := find(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] article a[href^='/journal?wiki=']")
		// Both prose renderers must use the site's canonical link treatment.
		styled, err := driver.ExecuteScript(`const link = arguments[0], s = getComputedStyle(link), canonical = getComputedStyle(document.querySelector('a[href="/journal?wiki=all"]')); return s.color === getComputedStyle(link.parentElement).color && s.fontStyle === 'italic' && s.textDecorationLine.includes('underline') && s.textDecorationColor === canonical.textDecorationColor`, []any{entity})
		if err != nil || styled != true {
			t.Fatalf("wiki link is not using canonical styling: %v %v", styled, err)
		}
		capture(page.name, "section[aria-label='Diary wiki']", 1440, 1400, true)
	}
	openPage("Maya")
	capture("07-wiki-maya-phone", "section[aria-label='Diary wiki']", 390, 1400, true)
	if err := driver.ResizeWindow("", 1440, 1100); err != nil {
		t.Fatal(err)
	}
	reference := find(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] a[aria-label^='Play source']")
	if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block:'center',behavior:'instant'});`, []any{reference}); err != nil {
		t.Fatal(err)
	}
	if err := reference.SendKeys(selenium.NullKey); err != nil {
		t.Fatal(err)
	}
	find(selenium.ByCSSSelector, "[role='tooltip']")
	data, err := driver.Screenshot()
	if err != nil {
		t.Fatal(err)
	}
	save("08-citation-preview-desktop", data)
	click(selenium.ByLinkText, "Days")
	launch := find(selenium.ByXPATH, "//summary[.//strong[normalize-space()='A quieter kind of launch']]")
	if err := launch.Click(); err != nil {
		t.Fatal(err)
	}
	// Read the selected day's section from the visible entry's enclosing DOM.
	section, err := launch.FindElement(selenium.ByXPATH, "ancestor::section[1]")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy(0,-90);`, []any{section}); err != nil {
		t.Fatal(err)
	}
	data, err = section.Screenshot(false)
	if err != nil {
		t.Fatal(err)
	}
	save("09-launch-day-desktop", data)
	earlier := find(selenium.ByXPATH, "//summary[.//strong[normalize-space()='An argument on the river path']]")
	if err := earlier.Click(); err != nil {
		t.Fatal(err)
	}
	earlierSection, err := earlier.FindElement(selenium.ByXPATH, "ancestor::section[1]")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy(0,-90);`, []any{earlierSection}); err != nil {
		t.Fatal(err)
	}
	data, err = earlierSection.Screenshot(false)
	if err != nil {
		t.Fatal(err)
	}
	save("10-earlier-day-clarification-desktop", data)
	if err := driver.ResizeWindow("", 390, 1400); err != nil {
		t.Fatal(err)
	}
	if _, err := driver.ExecuteScript(`arguments[0].scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy(0,-90);`, []any{section}); err != nil {
		t.Fatal(err)
	}
	data, err = section.Screenshot(false)
	if err != nil {
		t.Fatal(err)
	}
	save("11-launch-day-phone", data)
	if err := driver.ResizeWindow("", 1440, 1100); err != nil {
		t.Fatal(err)
	}
	// Match the calendar's browser time zone, including month boundaries.
	currentMonth, err := driver.ExecuteScript(`return new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'}).format(new Date())`, nil)
	if err != nil {
		t.Fatal(err)
	}
	currentYear, err := driver.ExecuteScript(`return String(new Date().getFullYear())`, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, view := range []struct{ name, link, visibleDate string }{
		{"12-months-desktop", "Months", currentMonth.(string)},
		{"13-weeks-desktop", "Weeks", "Monday"},
		{"14-years-desktop", "Years", currentYear.(string)},
	} {
		// Scrolling updates the date in the URL on a 250 ms throttle. Let
		// that visible navigation settle before selecting a different view.
		time.Sleep(400 * time.Millisecond)
		click(selenium.ByLinkText, view.link)
		var heading selenium.WebElement
		if view.link == "Years" {
			heading = find(selenium.ByXPATH, "//summary[.//time[normalize-space()='"+view.visibleDate+"']]")
		} else {
			heading = find(selenium.ByXPATH, "//summary[span[contains(.,'"+view.visibleDate+"')]]")
		}
		if _, err := heading.FindElement(selenium.ByXPATH, ".//strong[normalize-space()='Browse recordings']"); err != nil {
			t.Fatal("calendar period should browse recordings: ", err)
		}
		period, err := heading.FindElement(selenium.ByXPATH, "parent::details")
		if err != nil {
			t.Fatal(err)
		}
		if articles, err := period.FindElements(selenium.ByTagName, "article"); err != nil || len(articles) != 0 {
			t.Fatalf("calendar period contains generated articles: %d %v", len(articles), err)
		}
		capture(view.name, "nav[aria-label='Browse journal']", 1440, 1100, false)
		if view.link == "Years" {
			capture("15-years-phone", "nav[aria-label='Browse journal']", 390, 1100, false)
		}
	}
}
