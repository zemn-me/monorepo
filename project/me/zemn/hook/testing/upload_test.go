package testing_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestUploadReportsMeasuredProgressBeforeTheServerAcceptsIt(t *testing.T) {
	modulePath, err := runfiles.Rlocation(os.Getenv("UPLOAD_MODULE"))
	if err != nil {
		t.Fatal(err)
	}
	module, err := os.ReadFile(modulePath)
	if err != nil {
		t.Fatal(err)
	}
	type upload struct {
		method, contentType string
		size                int64
		digest              string
		err                 error
	}
	const uploadBytes = 16 << 20
	const expectedDigest = "22e57c15beae6221c5618a4d5158171cfdba5e66a32cb9165f5887a1d1cfe8e0"
	started := make(chan struct{})
	readBody := make(chan struct{})
	var readOnce sync.Once
	allowRead := func() { readOnce.Do(func() { close(readBody) }) }

	received := make(chan upload, 1)
	accepted := make(chan struct{})
	var acceptOnce sync.Once
	accept := func() { acceptOnce.Do(func() { close(accepted) }) }
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/upload.js":
			w.Header().Set("Content-Type", "text/javascript")
			_, _ = w.Write(module)
		case "/audio":
			close(started)
			<-readBody
			hash := sha256.New()
			size, err := io.Copy(hash, r.Body)
			received <- upload{r.Method, r.Header.Get("Content-Type"), size, hex.EncodeToString(hash.Sum(nil)), err}
			<-accepted
			w.WriteHeader(http.StatusNoContent)
		default:
			w.Header().Set("Content-Type", "text/html")
			_, _ = io.WriteString(w, `<!doctype html><output id="progress"></output><output id="status">pending</output>`)
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(accept)
	t.Cleanup(allowRead)
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { driver.Close() })
	if err := driver.Get(server.URL); err != nil {
		t.Fatal(err)
	}
	// This harness renders the public callback and promise results. It adds no
	// application globals and exercises the shipped helper with Chromium's XHR.
	if _, err := driver.ExecuteScript(`
 const values=[];
 import('/upload.js').then(({uploadJournalAudio}) => uploadJournalAudio(
  {url:'/audio',method:'PUT',headers:{'Content-Type':'audio/webm'}},
  new Blob([new Uint8Array(arguments[0]).fill(42)],{type:'audio/webm'}),
  value => { values.push(value ?? 'unknown'); document.querySelector('#progress').textContent=JSON.stringify(values); }
 )).then(() => document.querySelector('#status').textContent='complete',
         error => document.querySelector('#status').textContent=String(error));
 `, []interface{}{uploadBytes}); err != nil {
		t.Fatal(err)
	}
	// Hold the server's reads so TCP backpressure guarantees an intermediate
	// progress value. The payload exceeds the browser/socket upload buffers.
	select {
	case <-started:
	case <-time.After(10 * time.Second):
		t.Fatal("server did not start receiving audio")
	}
	var measured []any
	waitProgress := func(matches func(float64) bool) {
		t.Helper()
		if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
			output, err := w.FindElement(selenium.ByCSSSelector, "#progress")
			if err != nil {
				return false, err
			}
			text, err := output.Text()
			if err != nil {
				return false, err
			}
			if err := json.Unmarshal([]byte(text), &measured); err != nil {
				return false, nil
			}
			for _, value := range measured {
				if number, ok := value.(float64); ok && matches(number) {
					return true, nil
				}
			}
			return false, nil
		}, 10*time.Second); err != nil {
			t.Fatalf("missing progress in %v: %v", measured, err)
		}
	}
	waitProgress(func(value float64) bool { return value > 0 && value < 1 })
	allowRead()
	select {
	case got := <-received:
		if got.err != nil || got.method != "PUT" || got.contentType != "audio/webm" || got.size != uploadBytes || got.digest != expectedDigest {
			t.Fatalf("upload = %#v", got)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("server did not receive all audio")
	}
	waitProgress(func(value float64) bool { return value == 1 })
	status, err := driver.FindElement(selenium.ByCSSSelector, "#status")
	if err != nil {
		t.Fatal(err)
	}
	if text, err := status.Text(); err != nil || text != "pending" {
		t.Fatalf("completed before server acceptance: %q %v", text, err)
	}
	accept()
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) { text, err := status.Text(); return text == "complete", err }, 10*time.Second); err != nil {
		t.Fatal(err)
	}
}
