package server

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

type browserMail chan LoginEmail

func (m browserMail) Send(_ context.Context, _ string, email LoginEmail) error {
	m <- email
	return nil
}

type browserFiles struct {
	*testFiles
	origin string
}

func (f *browserFiles) Prepare(_ context.Context, key string) (Upload, error) {
	return Upload{URL: f.origin + "/upload", Fields: map[string]string{"key": key}}, nil
}

// The real prerendered app talks to the real Go handler on a distinct HTTPS
// origin. Only storage and email are doubles; Chromium enforces CORS and cookies.
func TestBrowserPublishingAcrossOrigins(t *testing.T) {
	build, err := runfiles.Rlocation("_main/project/nyc/bowerybugle/build")
	if err != nil {
		t.Fatal(err)
	}
	f := setup()
	mail := make(browserMail, 1)
	f.server.Mail = mail
	files := &browserFiles{testFiles: f.files}
	f.server.Files = files
	var staticCookie, uploadCookie atomic.Bool
	static := http.FileServer(http.Dir(build))
	handler := f.server.Handler()
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, _ := net.SplitHostPort(r.Host)
		switch host {
		case "api.bugle.example.test":
			handler.ServeHTTP(w, r)
		case "uploads.bugle.example.test":
			if r.Header.Get("Cookie") != "" {
				uploadCookie.Store(true)
			}
			w.Header().Set("Access-Control-Allow-Origin", f.server.Origin)
			if err := r.ParseMultipartForm(1024); err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			defer r.MultipartForm.RemoveAll()
			file, _, err := r.FormFile("file")
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			defer file.Close()
			data, err := io.ReadAll(file)
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			files.objects[r.FormValue("key")] = Object{Version: "browser-version", Size: int64(len(data)), ContentType: "application/pdf", Prefix: data}
			w.WriteHeader(204)
		default:
			if r.Header.Get("Cookie") != "" {
				staticCookie.Store(true)
			}
			if r.URL.Path == "/manage" {
				r.URL.Path = "/manage.html"
			}
			static.ServeHTTP(w, r)
		}
	}))
	_, port, _ := net.SplitHostPort(server.Listener.Addr().String())
	f.server.Origin = "https://bugle.example.test:" + port
	files.origin = "https://uploads.bugle.example.test:" + port
	server.StartTLS()
	defer server.Close()
	driver, err := seleniumutil.NewWithChromeArguments("--ignore-certificate-errors", "--no-proxy-server", "--host-resolver-rules=MAP *.example.test 127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	wait := func(script string) {
		t.Helper()
		if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			result, err := wd.ExecuteScript("return "+script, nil)
			return result == true, err
		}, 20*time.Second); err != nil {
			t.Fatal(err)
		}
	}
	click := func(selector string) {
		t.Helper()
		element, err := driver.FindElement(selenium.ByCSSSelector, selector)
		if err != nil {
			t.Fatal(err)
		}
		if err := element.Click(); err != nil {
			t.Fatal(err)
		}
	}
	screenshot := func(name string) {
		t.Helper()
		if out := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); out != "" {
			data, err := driver.Screenshot()
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(out, name+".png"), data, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := driver.ResizeWindow("", 1280, 1000); err != nil {
		t.Fatal(err)
	}
	if err := driver.Get(f.server.Origin); err != nil {
		t.Fatal(err)
	}
	wait("document.querySelectorAll('#issue-list li').length === 6")
	screenshot("public-desktop")
	before, err := driver.ExecuteScript("return performance.timeOrigin", nil)
	if err != nil {
		t.Fatal(err)
	}
	click("#show-login")
	wait("document.querySelector('#login-form') !== null")
	after, err := driver.ExecuteScript("return performance.timeOrigin", nil)
	if err != nil || after != before {
		t.Fatal("Remix navigation reloaded the document", err)
	}
	email, err := driver.FindElement(selenium.ByCSSSelector, "#email")
	if err != nil {
		t.Fatal(err)
	}
	if err := email.SendKeys(f.server.Author); err != nil {
		t.Fatal(err)
	}
	click("#login-form button")
	var login LoginEmail
	select {
	case login = <-mail:
	case <-time.After(20 * time.Second):
		t.Fatal("login email was not sent")
	}
	if err := driver.Get(login.Link); err != nil {
		t.Fatal(err)
	}
	wait("document.querySelector('#confirm-login') !== null && location.hash === ''")
	click("#confirm-login")
	wait("document.querySelectorAll('.issue-controls').length === 6")
	click("#add-issue button")
	wait("document.querySelector('#issue-7') !== null")
	click("#issue-7 summary")
	pdf := filepath.Join(t.TempDir(), "issue.pdf")
	if err := os.WriteFile(pdf, []byte("%PDF-browser-upload"), 0600); err != nil {
		t.Fatal(err)
	}
	input, err := driver.FindElement(selenium.ByCSSSelector, "#pdf-7")
	if err != nil {
		t.Fatal(err)
	}
	if err := input.SendKeys(pdf); err != nil {
		t.Fatal(err)
	}
	click("#issue-7 form button")
	wait("document.querySelector('#issue-7 .issue-line a') !== null")
	link, err := driver.ExecuteScript("return document.querySelector('#issue-7 .issue-line a').href", nil)
	if err != nil || link != fmt.Sprintf("https://api.bugle.example.test:%s/api/issues/7/pdf", port) {
		t.Fatalf("wrong PDF origin: %v %v", link, err)
	}
	screenshot("manage-desktop")
	click(".management-nav a")
	wait("document.querySelector('#show-edit') !== null && document.querySelectorAll('.issue-controls').length === 0")
	wait("document.querySelector('#issue-7 .issue-line a') !== null")
	if err := driver.ResizeWindow("", 390, 844); err != nil {
		t.Fatal(err)
	}
	screenshot("public-mobile")
	click("#show-edit")
	wait("document.querySelectorAll('.issue-controls').length === 7")
	screenshot("manage-mobile")
	// Full navigation verifies the HttpOnly API-host cookie survives page reload.
	if err := driver.Get(f.server.Origin + "/manage"); err != nil {
		t.Fatal(err)
	}
	wait("document.querySelectorAll('.issue-controls').length === 7")
	click("#logout")
	wait("document.querySelector('#login-form') !== null && document.querySelectorAll('.issue-controls').length === 0")
	if staticCookie.Load() || uploadCookie.Load() {
		t.Fatal("API session cookie leaked to the static or upload host")
	}
	if cookies, err := driver.GetCookies(); err != nil {
		t.Fatal(err)
	} else {
		for _, cookie := range cookies {
			if strings.Contains(cookie.Name, "bugle-session") {
				t.Fatal("session cookie belongs to static host")
			}
		}
	}
}
