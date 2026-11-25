package selenium_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	"github.com/zemn-me/monorepo/project/me/zemn/testing/browserhelpers"
)

// The fictional corpus is a local API fixture. Production bundles deliberately
// omit the development button that invokes this endpoint in local previews.
var seedJournalWikiFixture = sync.OnceValue(func() error {
	api, err := browserhelpers.APIRoot()
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

func TestJournalWikiNavigationWithoutSessionCookie(t *testing.T) {
	testWikiNavigation(t, true)
}

func TestJournalWikiNavigationAndCitations(t *testing.T) {
	testWikiNavigation(t, false)
}

type journalRequest struct{ method, path string }

// Read requests when Chrome sends them, including requests still in flight.
func readJournalAPIRequests(t *testing.T, driver selenium.WebDriver, api url.URL) []journalRequest {
	t.Helper()
	entries, err := driver.Log(log.Performance)
	if err != nil {
		t.Fatal(err)
	}
	var requests []journalRequest
	for _, entry := range entries {
		var event struct {
			Message struct {
				Method string
				Params struct{ Request struct{ Method, URL string } }
			}
		}
		if err := json.Unmarshal([]byte(entry.Message), &event); err != nil {
			t.Fatal(err)
		}
		if event.Message.Method != "Network.requestWillBeSent" {
			continue
		}
		request := event.Message.Params.Request
		u, err := url.Parse(request.URL)
		if err == nil && u.Scheme == api.Scheme && u.Host == api.Host {
			requests = append(requests, journalRequest{request.Method, u.Path})
		}
	}
	return requests
}

func testWikiNavigation(t *testing.T, browserOnly bool) {
	t.Helper()
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := browserhelpers.FrontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeCapabilities(selenium.Capabilities{"goog:loggingPrefs": map[string]string{"performance": "ALL"}})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.ResizeWindow("", 390, 900); err != nil {
		t.Fatal(err)
	}
	if browserOnly {
		if err := driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
			t.Fatal(err)
		}
		if err := driver.ExecuteChromiumCommand("Network.setBlockedURLs", map[string]any{"urls": []string{"*/auth/session"}}); err != nil {
			t.Fatal(err)
		}
	}
	var originalVideo selenium.WebElement
	api, err := browserhelpers.APIRoot()
	if err != nil {
		t.Fatal(err)
	}
	assertWikiRequests := func() []journalRequest {
		t.Helper()
		requests := readJournalAPIRequests(t, driver, api)
		for _, request := range requests {
			if request.path == "/journal" || request.path == "/journal/entries" {
				t.Fatalf("wiki loaded recording data: %v", request)
			}
		}
		return requests
	}
	assertWikiNavigation := func() {
		t.Helper()
		assertWikiRequests()
		browserhelpers.AssertHeroVideoPreserved(t, driver, originalVideo)
		visible, err := driver.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]').getBoundingClientRect(); return bar.top >= 0 && bar.bottom <= window.innerHeight && bar.height < 100;`, nil)
		if err != nil || visible != true {
			t.Fatalf("wiki navigation hid the compact navigation bar: %v %v", visible, err)
		}
	}
	root.Path, root.RawQuery = "/journal", "wiki=all"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	originalVideo, err = driver.FindElement(selenium.ByCSSSelector, "figure video")
	if err != nil {
		t.Fatal(err)
	}
	search, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input[type='search']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	assertWikiNavigation()
	if err := search.SendKeys("Maya"); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//a[strong[normalize-space()='Maya']]", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := search.SendKeys(selenium.TabKey); err != nil {
		t.Fatal(err)
	}
	focused, err := driver.ExecuteScript(`return document.activeElement?.textContent?.includes('Maya');`, nil)
	if err != nil || focused != true {
		t.Fatalf("wiki page is not keyboard reachable: %v %v", focused, err)
	}
	// Keep observing the content itself while the router transitions. Both the
	// previous and the next screen are valid, a header-only screen is not.
	_, err = driver.ExecuteScript(`
		const check = () => {
			const wiki = document.querySelector('section[aria-label="Diary wiki"]');
			if (wiki && !wiki.querySelector('article h3, input[type="search"]')) {
				performance.mark('wiki-incomplete', {detail: wiki.innerText});
			}
		};
		new MutationObserver(check).observe(document.body, {childList: true, subtree: true});
		performance.mark('wiki-start');
	`, nil)
	if err != nil {
		t.Fatal(err)
	}
	assertWikiLoadedWithRoute := func() {
		t.Helper()
		gaps, err := driver.ExecuteScript(`return performance.getEntriesByName('wiki-start').length === 1 ?
			performance.getEntriesByName('wiki-incomplete').map(mark => mark.detail) : ['document reloaded'];`, nil)
		if err != nil || len(gaps.([]any)) != 0 {
			t.Fatalf("wiki navigation had an intermediate screen: %v %v", gaps, err)
		}
	}
	if err := driver.KeyDown(selenium.EnterKey); err != nil {
		t.Fatal(err)
	}
	if err := driver.KeyUp(selenium.EnterKey); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//h3[normalize-space()='Maya']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	assertWikiLoadedWithRoute()
	assertWikiNavigation()
	for _, step := range []struct {
		link, destination string
	}{
		{"//section[@aria-label='Diary wiki']//article//a[normalize-space()='Lantern']", "//section[@aria-label='Diary wiki']//h3[normalize-space()='Lantern']"},
		{"//section[@aria-label='Diary wiki']//h2/a[normalize-space()='Wiki']", "//section[@aria-label='Diary wiki']//input[@type='search']"},
		{"//section[@aria-label='Diary wiki']//a[strong[normalize-space()='Maya']]", "//section[@aria-label='Diary wiki']//h3[normalize-space()='Maya']"},
	} {
		if err := browserhelpers.ClickElementWithRetry(driver, selenium.ByXPATH, step.link, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, step.destination, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		assertWikiLoadedWithRoute()
		assertWikiNavigation()
	}
	if browserOnly {
		cookies, err := driver.GetCookies()
		if err != nil {
			t.Fatal(err)
		}
		for _, cookie := range cookies {
			if cookie.Name == "__Host-zemn-authorization" {
				t.Fatal("expected a browser-only sign-in")
			}
		}
		return
	}
	for _, width := range []int{1280, 390} {
		if err := driver.ResizeWindow("", width, 900); err != nil {
			t.Fatal(err)
		}
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
			"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": false,
		}); err != nil {
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
	// Observe a fresh poll of this article before checking for unwanted recording requests.
	address, err := driver.CurrentURL()
	if err != nil {
		t.Fatal(err)
	}
	current, err := url.Parse(address)
	if err != nil {
		t.Fatal(err)
	}
	pageRequest := journalRequest{"GET", "/journal/wiki/" + current.Query().Get("wiki")}
	assertWikiRequests()
	waitForArticleRequest := func() {
		t.Helper()
		if err := driver.WaitWithTimeout(func(selenium.WebDriver) (bool, error) {
			requests := assertWikiRequests()
			if slices.Contains(requests, journalRequest{"GET", "/journal/wiki"}) {
				t.Fatal("individual page loaded the whole wiki index")
			}
			return slices.Contains(requests, pageRequest), nil
		}, 30*time.Second); err != nil {
			t.Fatalf("did not observe %s %s: %v", pageRequest.method, pageRequest.path, err)
		}
	}
	waitForArticleRequest()
	// A reload of an individual page should fetch that page alone.
	if err := driver.Refresh(); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//h3[normalize-space()='Maya']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	waitForArticleRequest()
	// Follow an inline citation as a user would, through the footnote preview.
	if err := browserhelpers.ClickElementWithRetry(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki'] a[aria-label^='Play source']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "[aria-label='Journal player'] input[aria-label='Seek recording']", 30*time.Second); err != nil {
		t.Fatal("citation did not open source audio: ", err)
	}
	root.Path, root.RawQuery = "/journal", "wiki=00000000-0000-0000-0000-000000000000"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, "//section[@aria-label='Diary wiki']//*[@role='status' and contains(.,'unavailable')]", 30*time.Second); err != nil {
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

func TestJournalDayNavigationLoadsWithRoute(t *testing.T) {
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := browserhelpers.FrontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeArguments()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	root.Path = "/journal"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByLinkText, "Browse days", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		_, err := d.GetCookie("__Host-zemn-authorization")
		return err == nil, nil
	}, 10*time.Second); err != nil {
		t.Fatal("expected a signed-in journal session", err)
	}
	document, err := driver.FindElement(selenium.ByTagName, "html")
	if err != nil {
		t.Fatal(err)
	}
	for _, step := range []struct{ link, title string }{
		{"section[aria-labelledby='recent-journal-entries'] header a", "A quieter kind of launch"},
		{"a[aria-label='Previous day']", "The rehearsal found the wrong problem"},
	} {
		link, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, step.link, 10*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		start, err := driver.ExecuteScript(`
			const title = arguments[0];
			const observer = new MutationObserver(() => {
				if (document.querySelector('[aria-label="Loading journal"]')) {
					performance.mark('journal-placeholder');
				}
				if ([...document.querySelectorAll('article > header h3')].some(h => h.textContent === title)) {
					observer.disconnect();
				}
			});
			observer.observe(document.body, {childList: true, subtree: true});
			return performance.now();
		`, []any{step.title})
		if err != nil {
			t.Fatal(err)
		}
		if err := browserhelpers.ClickElementInView(driver, link); err != nil {
			t.Fatal(err)
		}
		if _, err := browserhelpers.WaitForElement(driver, selenium.ByXPATH, "//article/header/h3[normalize-space()='"+step.title+"']", 10*time.Second); err != nil {
			t.Fatal(err)
		}
		if _, err := document.TagName(); err != nil {
			t.Fatal("day navigation replaced the document", err)
		}
		placeholder, err := driver.ExecuteScript("return performance.getEntriesByName('journal-placeholder').length > 0", nil)
		if err != nil || placeholder != false {
			t.Fatalf("day navigation showed a second loading state: %v %v", placeholder, err)
		}
		requests, err := driver.ExecuteScript(`
			return performance.getEntriesByType('resource')
				.filter(resource => resource.startTime >= arguments[0])
				.map(resource => new URL(resource.name))
				.filter(url => url.pathname === '/journal' && url.searchParams.get('view') === 'day')
				.map(url => url.search);
		`, []any{start})
		if err != nil || len(requests.([]any)) != 0 {
			t.Errorf("opening %s fetched day data again after navigation: %v %v", step.title, requests, err)
		}
	}
}

// These screenshots use authored fictional content through the normal local
// sample-data flow, so UI reviews do not require a paid model or private diary.
func TestJournalReviewScreenshots(t *testing.T) {
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := browserhelpers.FrontendRoot()
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
	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "button[aria-label='Log out']", 30*time.Second); err != nil {
		t.Fatalf("authenticated account controls: %v", err)
	}
	find := func(by, selector string) selenium.WebElement {
		t.Helper()
		el, err := browserhelpers.WaitForElement(driver, by, selector, 30*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		return el
	}
	click := func(by, selector string) {
		t.Helper()
		if by == selenium.ByLinkText {
			switch selector {
			case "Overview":
				if err := browserhelpers.ClickElementWithRetry(driver, selenium.ByCSSSelector, "h1 a[href='/journal']", 10*time.Second); err != nil {
					t.Fatal(err)
				}
				browserhelpers.AssertJournalNavigationAtTop(t, driver, "/journal")
				return
			case "Days", "Months", "Weeks", "Years":
				if links, err := driver.FindElements(selenium.ByCSSSelector, "[data-journal-toolbar] a[href='/journal']"); err == nil && len(links) > 0 {
					if err := browserhelpers.ClickElementInView(driver, links[0]); err != nil {
						t.Fatal(err)
					}
				}
				browserhelpers.OpenJournalDatePicker(t, driver)
				switch selector {
				case "Days":
					by, selector = selenium.ByCSSSelector, "a[aria-current='date']"
				case "Months":
					by, selector = selenium.ByCSSSelector, "a[aria-label='Month summary']"
				case "Weeks":
					by, selector = selenium.ByCSSSelector, "a[aria-label='Week summary']"
				case "Years":
					if err := browserhelpers.ClickElementWithRetry(driver, selenium.ByCSSSelector, "button[aria-label='Choose month']", 10*time.Second); err != nil {
						t.Fatal(err)
					}
					by, selector = selenium.ByCSSSelector, "a[aria-label='Year summary']"
				}
			case "Wiki":
				browserhelpers.ClickJournalWiki(t, driver)
				return
			}
		}
		if err := browserhelpers.ClickElementWithRetry(driver, by, selector, 30*time.Second); err != nil {
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
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
			"width": width, "height": height, "deviceScaleFactor": 1, "mobile": false,
		}); err != nil {
			t.Fatal(err)
		}
		defer func() {
			if err := driver.ExecuteChromiumCommand("Emulation.clearDeviceMetricsOverride", map[string]any{}); err != nil {
				t.Error(err)
			}
		}()
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
	find(selenium.ByID, "recent-journal-entries")
	capture("01-overview-desktop", "[data-journal-page]", 1440, 1000, false)
	capture("01-overview-phone", "[data-journal-page]", 390, 844, false)
	recentLink := find(selenium.ByCSSSelector, "section[aria-labelledby='recent-journal-entries'] li a")
	recentTitle := find(selenium.ByCSSSelector, "section[aria-labelledby='recent-journal-entries'] li strong")
	wantTitle, err := recentTitle.Text()
	if err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.ClickElementInView(driver, recentLink); err != nil {
		t.Fatal(err)
	}
	find(selenium.ByCSSSelector, "[aria-label='Journal day'] article[id^='entry-']")
	address, err := driver.CurrentURL()
	if err != nil {
		t.Fatal(err)
	}
	selected, err := url.Parse(address)
	if err != nil || selected.Fragment == "" || selected.Fragment != "entry-"+selected.Query().Get("entry") {
		t.Fatalf("recent entry destination: %s %v", address, err)
	}
	selectedArticle := find(selenium.ByID, selected.Fragment)
	selectedTitle, err := selectedArticle.FindElement(selenium.ByCSSSelector, "header h3")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := selectedTitle.Text(); err != nil || got != wantTitle {
		t.Fatalf("recent entry opened %q, want %q: %v", got, wantTitle, err)
	}
	find(selenium.ByXPATH, "//*[@aria-label='Journal player']//strong/a[normalize-space()='"+wantTitle+"']")
	click(selenium.ByCSSSelector, "button[aria-label='Close player']")
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
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='A quieter kind of launch']")
	capture("09-launch-day-desktop", "[data-journal-page]", 1440, 1000, false)
	click(selenium.ByCSSSelector, "a[aria-label='Previous day']")
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='The rehearsal found the wrong problem']")
	click(selenium.ByCSSSelector, "a[aria-label='Previous day']")
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='An argument on the river path']")
	capture("10-earlier-day-clarification-desktop", "[aria-label='Journal day']", 1440, 1000, false)
	if err := driver.Back(); err != nil {
		t.Fatal(err)
	}
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='The rehearsal found the wrong problem']")
	if err := driver.Back(); err != nil {
		t.Fatal(err)
	}
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='A quieter kind of launch']")
	capture("11-launch-day-phone", "[data-journal-page]", 390, 844, false)
	if err := driver.ResizeWindow("", 1440, 1100); err != nil {
		t.Fatal(err)
	}
	click(selenium.ByCSSSelector, "button[aria-label='Play A quieter kind of launch']")
	slider := find(selenium.ByCSSSelector, "input[aria-label='Seek recording']")
	waitForWaveform := func() {
		t.Helper()
		if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			value, err := wd.ExecuteScript(`
			const canvas = document.querySelector('[aria-label="Journal player"] canvas');
			if (!canvas || !canvas.width || !canvas.height) return false;
			const row = canvas.getContext('2d').getImageData(0, Math.floor(canvas.height / 3), canvas.width, 1).data;
			return row.some((value, index) => index % 4 === 3 && value > 0);
		`, nil)
			return value == true, err
		}, 15*time.Second); err != nil {
			t.Fatal("recording waveform did not show audible peaks", err)
		}
	}
	waitForWaveform()
	if buttons, _ := driver.FindElements(selenium.ByCSSSelector, "button[aria-label='Pause recording']"); len(buttons) > 0 {
		if err := browserhelpers.ClickElementInView(driver, buttons[0]); err != nil {
			t.Fatal(err)
		}
	}
	if err := slider.SendKeys(selenium.HomeKey + selenium.RightArrowKey); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		v, err := wd.ExecuteScript("const a=document.querySelector('main audio'); return a.paused && Math.abs(a.currentTime - 0.1) < 0.05", nil)
		return v == true, err
	}, 5*time.Second); err != nil {
		t.Fatal("keyboard scrubbing did not seek the paused recording", err)
	}
	for _, size := range []struct{ width, height int }{{1440, 1000}, {390, 844}} {
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
			"width": size.width, "height": size.height, "deviceScaleFactor": 1, "mobile": false,
		}); err != nil {
			t.Fatal(err)
		}
		for _, title := range []string{"Coffee with Maya before the pilot", "A quieter kind of launch"} {
			titleLink := find(selenium.ByXPATH, "//article/header/h3/a[normalize-space()='"+title+"']")
			if err := browserhelpers.ClickElementInView(driver, titleLink); err != nil {
				t.Fatal(err)
			}
			if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
				valid, err := d.ExecuteScript(`
				const player = document.querySelector('[aria-label="Journal player"]');
				return document.querySelectorAll('main audio').length === 1 &&
					document.querySelectorAll('[aria-label="Seek recording"]').length === 1 &&
					document.querySelectorAll('[aria-label="Transcript"]').length === 1 &&
					player?.querySelector('strong')?.textContent === arguments[0];
			`, []any{title})
				return valid == true, err
			}, 10*time.Second); err != nil {
				t.Fatalf("switch to %s left duplicate or stale controls: %v", title, err)
			}
		}
		if _, err := driver.ExecuteScript(`
			const heading = document.querySelector("article[id^='entry-'] > header");
			const toolbar = document.querySelector('[data-journal-toolbar]');
			const pinnedHeight = parseFloat(getComputedStyle(toolbar).top) + toolbar.offsetHeight;
			window.scrollBy({top: heading.getBoundingClientRect().top - pinnedHeight - 12, behavior: 'instant'});
		`, nil); err != nil {
			t.Fatal(err)
		}
		if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			state, err := wd.ExecuteScript(`
				const player=document.querySelector('[aria-label="Journal player"]').getBoundingClientRect();
				const banner=document.querySelector('header[data-glade-banner]').getBoundingClientRect();
				const toolbar=document.querySelector('[data-journal-toolbar]').getBoundingClientRect();
				if (scrollY <= 0 || toolbar.bottom >= innerHeight) return false;
				if (arguments[0]) return player.right < toolbar.left && player.top >= banner.bottom && player.bottom <= innerHeight;
				return Math.abs(player.top-banner.bottom) <= 1 && Math.abs(toolbar.top-player.bottom) <= 1;
			`, []any{size.width == 1440})
			return state == true, err
		}, 5*time.Second); err != nil {
			t.Fatalf("pinned controls at width %d: %v", size.width, err)
		}
		if size.width == 390 {
			waitForWaveform()
			shot, err := driver.Screenshot()
			if err != nil {
				t.Fatal(err)
			}
			save("18-pinned-player-phone", shot)
		}
	}
	if err := driver.ExecuteChromiumCommand("Emulation.clearDeviceMetricsOverride", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	capture("16-player-desktop", "[data-journal-page]", 1440, 1000, false)
	capture("17-player-phone", "[data-journal-page]", 390, 844, false)
	click(selenium.ByLinkText, "Wiki")
	find(selenium.ByCSSSelector, "section[aria-label='Diary wiki']")
	find(selenium.ByCSSSelector, "[aria-label='Journal player'] [aria-label='Transcript']")
	click(selenium.ByCSSSelector, "[aria-label='Journal player'] strong a")
	find(selenium.ByCSSSelector, "[aria-label='Journal day']")
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		result, err := wd.ExecuteScript(`
			const entry = document.getElementById(location.hash.slice(1));
			const heading = entry?.querySelector('header h3');
			const player = document.querySelector('[aria-label="Journal player"] strong a');
			const toolbar = document.querySelector('[data-journal-toolbar]');
			if (!heading || !player || !toolbar) return false;
			const rect = heading.getBoundingClientRect();
			return heading.textContent === player.textContent &&
				rect.top >= toolbar.getBoundingClientRect().bottom && rect.bottom <= innerHeight;
		`, nil)
		return result == true, err
	}, 5*time.Second); err != nil {
		t.Fatal("player title did not bring the selected entry into view", err)
	}
	click(selenium.ByCSSSelector, "button[aria-label='Close player']")
	// Use the rehearsal day for aggregate screenshots. Its week and month
	// always contain another fixture day, even when the launch is the only
	// day in a new month and correctly reuses its day summary instead.
	click(selenium.ByCSSSelector, "a[aria-label='Previous day']")
	find(selenium.ByXPATH, "//article/header/h3[normalize-space()='The rehearsal found the wrong problem']")
	// The date picker preserves the selected day, which can be in the
	// previous month or year. Format that route date in the browser's time zone.
	selectedURL, err := driver.CurrentURL()
	if err != nil {
		t.Fatal(err)
	}
	selectedRoute, err := url.Parse(selectedURL)
	if err != nil {
		t.Fatal(err)
	}
	selectedAt := selectedRoute.Query().Get("at")
	if _, err := time.Parse(time.RFC3339Nano, selectedAt); err != nil {
		t.Fatalf("selected rehearsal day in %s: %v", selectedURL, err)
	}
	selectedMonth, err := driver.ExecuteScript(`return new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric'}).format(new Date(arguments[0]))`, []any{selectedAt})
	if err != nil {
		t.Fatal(err)
	}
	selectedYear, err := driver.ExecuteScript(`return String(new Date(arguments[0]).getFullYear())`, []any{selectedAt})
	if err != nil {
		t.Fatal(err)
	}
	for _, view := range []struct{ name, link, visibleDate, period, child, title string }{
		{"12-months-desktop", "Months", selectedMonth.(string), "month", "day", "Experiments in attention"},
		{"13-weeks-desktop", "Weeks", "Monday", "week", "day", "Making room for steadier work"},
		{"14-years-desktop", "Years", selectedYear.(string), "year", "month", "A life with more room in it"},
	} {
		click(selenium.ByLinkText, view.link)
		regionSelector := "[role='region'][aria-label='Journal " + view.period + "']"
		find(selenium.ByCSSSelector, regionSelector)
		if sections, err := driver.FindElements(selenium.ByCSSSelector, regionSelector+" > section"); err != nil || len(sections) != 1 {
			t.Fatalf("selected %s should render one period: %d %v", view.period, len(sections), err)
		}
		period := find(selenium.ByCSSSelector, regionSelector+" > section")
		heading, err := period.FindElement(selenium.ByXPATH, ".//header[h2[normalize-space()='"+view.title+"'] and span[contains(.,'"+view.visibleDate+"')]]")
		if err != nil {
			t.Fatal("missing calendar period heading: ", err)
		}
		if visible, err := heading.IsDisplayed(); err != nil || !visible {
			t.Fatalf("calendar period heading should be visible: %v %v", visible, err)
		}
		if articles, err := period.FindElements(selenium.ByTagName, "article"); err != nil || len(articles) != 1 {
			t.Fatalf("calendar period should contain its summary: %d %v", len(articles), err)
		}
		children, err := period.FindElements(selenium.ByCSSSelector, "ol[aria-label='Browse "+view.child+"s'] a[href^='/journal/"+view.child+"?at=']")
		if err != nil || len(children) == 0 {
			t.Fatalf("calendar period should link to its %ss: %d %v", view.child, len(children), err)
		}
		if visible, err := children[0].IsDisplayed(); err != nil || !visible {
			t.Fatalf("calendar child periods should be visible: %v %v", visible, err)
		}
		capture(view.name, regionSelector, 1440, 1100, false)
		if view.link == "Years" {
			capture("15-years-phone", regionSelector, 390, 1100, false)
		}
	}
}

func TestJournalWikiUploadConfirmation(t *testing.T) {
	if err := seedJournalWikiFixture(); err != nil {
		t.Fatal(err)
	}
	root, err := browserhelpers.FrontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.NewWithChromeCapabilities(selenium.Capabilities{"goog:loggingPrefs": map[string]string{"performance": "ALL"}})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.SetTimezoneOverride("America/Los_Angeles"); err != nil {
		t.Fatal(err)
	}
	root.Path, root.RawQuery = "/journal", "wiki=all"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.PerformOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input[type='search']", 30*time.Second); err != nil {
		t.Fatal(err)
	}

	audio := browserhelpers.TestWAV()
	audio[len(audio)-10] = 91
	path := filepath.Join(t.TempDir(), "wiki-confirmation.wav")
	if err := os.WriteFile(path, audio, 0600); err != nil {
		t.Fatal(err)
	}
	date := time.Date(2008, time.May, 13, 20, 0, 0, 0, time.UTC)
	if err := os.Chtimes(path, date, date); err != nil {
		t.Fatal(err)
	}
	importJournalFiles(t, driver, []string{path})
	if _, err := driver.FindElement(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input[type='search']"); err != nil {
		t.Fatal("upload left the wiki: ", err)
	}
	api, err := browserhelpers.APIRoot()
	if err != nil {
		t.Fatal(err)
	}
	requests := readJournalAPIRequests(t, driver, api)
	if slices.Contains(requests, journalRequest{"GET", "/journal"}) ||
		!slices.Contains(requests, journalRequest{"POST", "/journal/entries"}) ||
		!slices.Contains(requests, journalRequest{"GET", "/journal/entries"}) {
		t.Fatalf("wiki confirmation did not use lightweight metadata: %v", requests)
	}

	// Confirm the recording exists in the journal before removing the fixture.
	root.Path, root.RawQuery = "/journal/day", url.Values{"at": {date.Format(time.RFC3339)}}.Encode()
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	selector := "[role='region'][aria-label='Journal day'] article[id^='entry-']:has(> header time[datetime^='2008-05-13'])"
	entry, err := browserhelpers.WaitForElement(driver, selenium.ByCSSSelector, selector, 30*time.Second)
	if err != nil {
		browserhelpers.DumpPageDiagnostics(t, driver)
		t.Fatal("confirmed recording was not ready in the journal: ", err)
	}
	summary, err := entry.FindElement(selenium.ByCSSSelector, "summary[aria-label='Recording options']")
	if err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.ClickElementInView(driver, summary); err != nil {
		t.Fatal(err)
	}
	remove, err := entry.FindElement(selenium.ByCSSSelector, "[role='slider'][aria-label='Swipe to delete journal entry']")
	if err != nil {
		t.Fatal(err)
	}
	if err := remove.SendKeys(selenium.EndKey + selenium.EnterKey); err != nil {
		t.Fatal(err)
	}
	if err := browserhelpers.WaitForNoElement(driver, selenium.ByCSSSelector, selector, 30*time.Second); err != nil {
		t.Fatal(err)
	}
}
