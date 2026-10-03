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
	transport := httptest.NewTLSServer(proxy)
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
