package selenium_test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestJournalWikiNavigationAndCitations(t *testing.T) {
	root, err := nextServerRoot()
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
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	seed, err := waitForElement(driver, selenium.ByXPATH, "//button[normalize-space()='Add sample entries']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := seed.Click(); err != nil {
		t.Fatal(err)
	}
	status, err := waitForElement(driver, selenium.ByXPATH, "//*[@role='status' and contains(.,'Sample journal ready')] | //*[@role='alert' and contains(.,'Could not add sample entries')]", 90*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if message, _ := status.Text(); message != "Sample journal ready" {
		t.Fatal(message)
	}
	wiki, err := driver.FindElement(selenium.ByLinkText, "Wiki")
	if err != nil {
		t.Fatal(err)
	}
	if err := wiki.Click(); err != nil {
		t.Fatal(err)
	}
	search, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki'] input[type='search']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
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
	reference, err := driver.FindElement(selenium.ByCSSSelector, "section[aria-label='Diary wiki'] [data-journal-summary-block] a")
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
