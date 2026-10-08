package selenium_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestJournalAuthenticatedServerRendering(t *testing.T) {
	root, err := frontendRoot()
	if err != nil {
		t.Fatal(err)
	}
	// Keep the application and API under rules_itest; this per-test TLS transport
	// exercises the same secure cookie rules as the deployed HTTPS frontend.
	upstream := root
	proxy := httputil.NewSingleHostReverseProxy(&upstream)
	direct := proxy.Director
	var publicOrigin string
	proxy.Director = func(req *http.Request) {
		if req.Header.Get("Origin") == publicOrigin {
			req.Header.Set("Origin", upstream.Scheme+"://"+upstream.Host)
		}
		direct(req)
		req.Host = upstream.Host
	}
	var delayNavigation atomic.Bool
	transport := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if delayNavigation.Load() && strings.HasSuffix(req.URL.Path, ".data") {
			select {
			case <-time.After(2 * time.Second):
			case <-req.Context().Done():
				return
			}
		}
		proxy.ServeHTTP(w, req)
	}))
	defer transport.Close()
	publicOrigin = transport.URL
	publicURL, err := url.Parse(publicOrigin)
	if err != nil {
		t.Fatal(err)
	}
	root = *publicURL
	root.Path, root.RawQuery = "/journal", "wiki=all"
	driver, err := seleniumpkg.NewWithChromeArguments("--ignore-certificate-errors")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	defer assertNoSevereBrowserLogs(t, driver)
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki']", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	var cookie selenium.Cookie
	if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		cookie, err = d.GetCookie("__Host-zemn-authorization")
		return err == nil, nil
	}, 10*time.Second); err != nil {
		t.Fatal("login did not synchronize the SSR cookie", err)
	}
	if !cookie.Secure || cookie.Path != "/" {
		t.Fatal("SSR cookie is not host-scoped and secure")
	}
	visibleToScript, err := driver.ExecuteScript(`return document.cookie.includes('__Host-zemn-authorization=');`, nil)
	if err != nil || visibleToScript != false {
		t.Fatal("the authorization cookie is visible to JavaScript", err)
	}
	// Read only the cookie established by the normal popup login, then inspect the
	// actual document response without running JavaScript or injecting auth state.
	rendered := func(cookie *selenium.Cookie) string {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), "GET", root.String(), nil)
		if err != nil {
			t.Fatal(err)
		}
		if cookie != nil {
			req.AddCookie(&http.Cookie{Name: cookie.Name, Value: cookie.Value})
		}
		rsp, err := transport.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer rsp.Body.Close()
		if rsp.StatusCode != 200 {
			t.Fatalf("document status %d", rsp.StatusCode)
		}
		if rsp.Header.Get("Cache-Control") != "private, no-store" {
			t.Fatalf("private HTML cache policy: %q", rsp.Header.Get("Cache-Control"))
		}
		body, err := io.ReadAll(rsp.Body)
		if err != nil {
			t.Fatal(err)
		}
		return string(body)
	}
	if !strings.Contains(rendered(&cookie), `aria-label="Diary wiki"`) {
		t.Fatal("authenticated wiki was not in the initial HTML")
	}
	if strings.Contains(rendered(nil), `aria-label="Diary wiki"`) {
		t.Fatal("anonymous response contains authenticated content")
	}
	for _, width := range []int{1280, 390} {
		if err := driver.ResizeWindow("", width, 900); err != nil {
			t.Fatal(err)
		}
		if err := driver.Refresh(); err != nil {
			t.Fatal(err)
		}
		wiki, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Diary wiki']", 30*time.Second)
		if err != nil {
			t.Fatal(err)
		}
		compact, err := driver.ExecuteScript(`const bar = document.querySelector('header[data-glade-banner]').getBoundingClientRect(); const heading = document.querySelector('h1').getBoundingClientRect(); return bar.top >= 0 && bar.height < 100 && heading.top >= bar.bottom && heading.bottom < window.innerHeight && getComputedStyle(document.querySelector('figure')).display === 'none';`, nil)
		if err != nil || compact != true {
			t.Fatalf("non-homepage content starts behind the hero at width %d: %v %v", width, compact, err)
		}
		video, err := driver.FindElement(selenium.ByCSSSelector, "figure video")
		if err != nil {
			t.Fatal(err)
		}
		delayNavigation.Store(true)
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
			if _, err := waitForElement(driver, selenium.ByCSSSelector, "[role='status'][aria-label='Loading page']", 5*time.Second); err != nil {
				t.Fatalf("%s navigation at width %d gave no loading feedback: %v", destination.label, width, err)
			}
			if destination.label == "Days" {
				if output := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); output != "" {
					shot, err := driver.Screenshot()
					if err != nil {
						t.Fatal(err)
					}
					name := "journal-loading-desktop.png"
					if width == 390 {
						name = "journal-loading-phone.png"
					}
					if err := os.WriteFile(filepath.Join(output, name), shot, 0o600); err != nil {
						t.Fatal(err)
					}
				}
			}
			if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
				pending, err := d.FindElements(selenium.ByCSSSelector, "[role='status'][aria-label='Loading page']")
				return len(pending) == 0, err
			}, 30*time.Second); err != nil {
				t.Fatal(err)
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
			preserved, err := driver.ExecuteScript(`return arguments[0] === document.querySelector('figure video');`, []interface{}{video})
			if err != nil || preserved != true {
				t.Fatalf("%s navigation replaced the page: %v %v", destination.label, preserved, err)
			}
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
			pending, err := waitForElement(driver, selenium.ByCSSSelector, "[role='status'][aria-label='Loading page']", 5*time.Second)
			if err != nil {
				t.Fatalf("menu navigation to %s at width %d gave no loading feedback: %v", path, width, err)
			}
			if visible, err := pending.IsDisplayed(); err != nil || !visible {
				t.Fatal("page loading feedback is hidden", err)
			}
			if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
				current, err := d.CurrentURL()
				return current == publicOrigin+path, err
			}, 30*time.Second); err != nil {
				t.Fatal(err)
			}
			preserved, err := driver.ExecuteScript(`return arguments[0] === document.querySelector('figure video');`, []interface{}{video})
			if err != nil || preserved != true {
				t.Fatalf("menu navigation to %s replaced the page: %v %v", path, preserved, err)
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
		delayNavigation.Store(false)
		wiki, err = driver.FindElement(selenium.ByCSSSelector, "section[aria-label='Diary wiki']")
		if err != nil {
			t.Fatal(err)
		}
		if output := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); output != "" {
			shot, err := wiki.Screenshot(false)
			if err != nil {
				t.Fatal(err)
			}
			name := "journal-ssr-desktop.png"
			if width == 390 {
				name = "journal-ssr-phone.png"
			}
			if err := os.WriteFile(filepath.Join(output, name), shot, 0o600); err != nil {
				t.Fatal(err)
			}
		}
	}
	logout, err := waitForElement(driver, selenium.ByCSSSelector, "[data-glade-footer] button[aria-label='Log out']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := logout.Click(); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		_, err := d.GetCookie("__Host-zemn-authorization")
		return err != nil, nil
	}, 10*time.Second); err != nil {
		t.Fatal("logout did not remove the cookie", err)
	}
	if err := driver.Refresh(); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForLoginButtonReady(driver, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if elements, err := driver.FindElements(selenium.ByCSSSelector, "section[aria-label='Diary wiki']"); err != nil || len(elements) != 0 {
		t.Fatal("logout retained private content", err)
	}
}
