package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type memoryStore struct {
	mu      sync.Mutex
	records map[string]Record
	hits    map[string]int
}

func (m *memoryStore) Get(_ context.Context, k, id string) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.records[k+"/"+id]
	if !ok {
		return Record{}, ErrMissing
	}
	return v, nil
}
func (m *memoryStore) Put(_ context.Context, k, id string, v Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.records[k+"/"+id] = v
	return nil
}
func (m *memoryStore) Take(_ context.Context, k, id string, now int64) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := k + "/" + id
	v, ok := m.records[key]
	if !ok || v.Expires <= now {
		return Record{}, ErrMissing
	}
	delete(m.records, key)
	return v, nil
}
func (m *memoryStore) Limit(_ context.Context, key string, now, expiry int64, max int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.records[key].Expires <= now {
		m.records[key] = Record{Expires: expiry}
		m.hits[key] = 0
	}
	if m.hits[key] >= max {
		return false, nil
	}
	m.hits[key]++
	return true, nil
}
func (m *memoryStore) Issues(_ context.Context) ([]Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Record{}
	for key, v := range m.records {
		if strings.HasPrefix(key, "issue/") {
			out = append(out, v)
		}
	}
	return out, nil
}
func (m *memoryStore) Publish(_ context.Context, id string, now int64, rec Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := "upload/" + id
	if m.records[k].Expires <= now {
		return ErrMissing
	}
	if m.records["issue/"+issueID(rec.Number)].Revision != rec.Revision {
		return ErrConflict
	}
	rec.Revision = id
	delete(m.records, k)
	m.records["issue/"+issueID(rec.Number)] = rec
	return nil
}

func (m *memoryStore) ReplaceIssue(_ context.Context, old, next Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := "issue/" + issueID(next.Number)
	if m.records[k].Revision != old.Revision {
		return ErrConflict
	}
	m.records[k] = next
	return nil
}

type testFiles struct {
	objects    map[string]Object
	downloaded Record
}

func (f *testFiles) Prepare(_ context.Context, key string) (Upload, error) {
	return Upload{URL: "https://uploads.example.test", Fields: map[string]string{"key": key}}, nil
}
func (f *testFiles) Inspect(_ context.Context, key string) (Object, error) {
	o, ok := f.objects[key]
	if !ok {
		return Object{}, errors.New("missing upload")
	}
	return o, nil
}
func (f *testFiles) Download(_ context.Context, rec Record) (string, error) {
	f.downloaded = rec
	return "https://pdf.example.test/" + rec.Key + "?version=" + rec.Version, nil
}

type testMail struct {
	links      []string
	messages   []LoginEmail
	recipients []string
	err        error
}

func (m *testMail) Send(_ context.Context, to string, email LoginEmail) error {
	m.messages = append(m.messages, email)
	m.links = append(m.links, email.Link)
	m.recipients = append(m.recipients, to)
	return m.err
}

type fixture struct {
	server *Server
	store  *memoryStore
	files  *testFiles
	mail   *testMail
	now    time.Time
}

func setup() *fixture {
	f := &fixture{store: &memoryStore{records: map[string]Record{}, hits: map[string]int{}}, files: &testFiles{objects: map[string]Object{}}, mail: &testMail{}, now: time.Unix(1800000000, 0)}
	f.server = &Server{Store: f.store, Files: f.files, Mail: f.mail, Origin: "https://bugle.example.test", Author: "author@example.test", LoginKey: []byte("12345678901234567890123456789012"), Now: func() time.Time { return f.now }}
	return f
}
func (f *fixture) request(method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	data, _ := json.Marshal(body)
	r := httptest.NewRequest(method, path, bytes.NewReader(data))
	r.Header.Set("Origin", f.server.Origin)
	r.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	f.server.Handler().ServeHTTP(w, r)
	w.Result().Request = r
	return w
}
func status(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	assertAPIResponse(t, w)
	if w.Code != want {
		t.Fatalf("HTTP %d, want %d: %s", w.Code, want, w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("API response can be cached")
	}
}
func (f *fixture) challenge(t *testing.T) string {
	t.Helper()
	status(t, f.request("POST", "/api/login", map[string]string{"email": f.server.Author}, nil), 202)
	return strings.Split(f.mail.links[len(f.mail.links)-1], "#login=")[1]
}
func (f *fixture) login(t *testing.T) *http.Cookie {
	t.Helper()
	token := f.challenge(t)
	w := f.request("POST", "/api/login/confirm", map[string]string{"token": token}, nil)
	status(t, w, 200)
	return w.Result().Cookies()[0]
}

func TestAuthorLoginAndLogout(t *testing.T) {
	f := setup()
	status(t, f.request("POST", "/api/login", map[string]string{"email": "stranger@example.test"}, nil), 202)
	if len(f.mail.links) != 0 {
		t.Fatal("emailed a non-author")
	}
	tok := f.challenge(t)
	if f.mail.recipients[0] != f.server.Author || !strings.HasPrefix(f.mail.links[0], f.server.Origin+"/manage#login=") {
		t.Fatal("wrong recipient or untrusted email link")
	}
	for key := range f.store.records {
		if strings.HasPrefix(key, "challenge/") {
			t.Fatal("stored a challenge record")
		}
	}
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": token()}, nil), 400)
	w := f.request("POST", "/api/login/confirm", map[string]string{"token": tok}, nil)
	status(t, w, 200)
	c := w.Result().Cookies()[0]
	if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteStrictMode || c.Path != "/" || c.Domain != "" {
		t.Fatal("session cookie not protected")
	}
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": tok}, nil), 200)
	w = f.request("GET", "/api/session", nil, c)
	status(t, w, 200)
	if !strings.Contains(w.Body.String(), "true") {
		t.Fatal("not logged in")
	}
	status(t, f.request("POST", "/api/logout", map[string]string{}, c), 200)
	w = f.request("GET", "/api/session", nil, c)
	if !strings.Contains(w.Body.String(), "false") {
		t.Fatal("logout did not revoke session")
	}
}
func TestConcurrentChallengeReuse(t *testing.T) {
	f := setup()
	tok := f.challenge(t)
	var wg sync.WaitGroup
	codes := make(chan int, 8)
	for range 8 {
		wg.Go(func() { codes <- f.request("POST", "/api/login/confirm", map[string]string{"token": tok}, nil).Code })
	}
	wg.Wait()
	close(codes)
	success := 0
	for code := range codes {
		if code == 200 {
			success++
		} else if code != 400 {
			t.Fatalf("unexpected status %d", code)
		}
	}
	if success != 8 {
		t.Fatalf("redeemed %d times", success)
	}
}
func TestExpiryRateLimitsAndMailFailure(t *testing.T) {
	f := setup()
	tok := f.challenge(t)
	status(t, f.request("POST", "/api/login", map[string]string{"email": f.server.Author}, nil), 429)
	_, expiry, err := f.server.loginCode(f.now)
	if err != nil {
		t.Fatal(err)
	}
	f.now = expiry
	status(t, f.request("POST", "/api/login/confirm", map[string]string{"token": tok}, nil), 400)
	c := f.login(t)
	f.now = f.now.Add(7 * 24 * time.Hour)
	status(t, f.request("POST", "/api/uploads", map[string]any{"number": 6, "size": 9}, c), 401)
	f = setup()
	f.mail.err = errors.New("email delivery failed")
	status(t, f.request("POST", "/api/login", map[string]string{"email": f.server.Author}, nil), 503)
	if len(f.mail.messages) != 1 {
		t.Fatal("email was not attempted")
	}
	for key := range f.store.records {
		if strings.HasPrefix(key, "challenge/") {
			t.Fatal("mail failure left challenge state")
		}
	}
	f = setup()
	for range 10 {
		f.challenge(t)
		f.now = f.now.Add(time.Minute)
	}
	status(t, f.request("POST", "/api/login", map[string]string{"email": f.server.Author}, nil), 429)
}
func TestCrossOriginRequestsAreRejected(t *testing.T) {
	f := setup()
	c := f.login(t)
	for _, origin := range []string{"", "https://evil.example.test"} {
		r := httptest.NewRequest("POST", "/api/uploads", strings.NewReader(`{"number":6,"size":9}`))
		r.Header.Set("Origin", origin)
		r.AddCookie(c)
		w := httptest.NewRecorder()
		f.server.Handler().ServeHTTP(w, r)
		status(t, w, 403)
	}
}
func (f *fixture) upload(t *testing.T, c *http.Cookie, n int) Upload {
	t.Helper()
	w := f.request("POST", "/api/uploads", map[string]any{"number": n, "size": 9}, c)
	status(t, w, 200)
	var upload Upload
	if err := json.Unmarshal(w.Body.Bytes(), &upload); err != nil {
		t.Fatal(err)
	}
	return upload
}
func TestArchiveUploadReadAndReplace(t *testing.T) {
	f := setup()
	w := f.request("GET", "/api/issues", nil, nil)
	status(t, w, 200)
	var listing struct {
		Issues []Issue `json:"issues"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &listing); err != nil {
		t.Fatal(err)
	}
	if len(listing.Issues) != 6 || listing.Issues[0].Number != 6 || listing.Issues[5].Number != 1 {
		t.Fatal("missing initial issues")
	}
	for _, i := range listing.Issues {
		if i.PDF != "" {
			t.Fatal("invented a PDF")
		}
	}
	status(t, f.request("GET", "/api/issues/6/pdf", nil, nil), 404)
	status(t, f.request("POST", "/api/uploads", map[string]any{"number": 6, "size": 9}, nil), 401)
	c := f.login(t)
	for index := 1; index <= 2; index++ {
		upload := f.upload(t, c, 6)
		version := fmt.Sprint(index)
		f.files.objects[upload.Fields["key"]] = Object{Version: version, Size: 9, ContentType: "application/pdf", Prefix: []byte("%PDF-")}
		status(t, f.request("POST", "/api/uploads/"+upload.ID+"/publish", map[string]string{}, c), 200)
		status(t, f.request("POST", "/api/uploads/"+upload.ID+"/publish", map[string]string{}, c), 400)
		// A later POST to the same signed key cannot change the published version.
		f.files.objects[upload.Fields["key"]] = Object{Version: "overwritten"}
		w = f.request("GET", "/api/issues/6/pdf", nil, nil)
		status(t, w, 302)
		if f.files.downloaded.Version != version {
			t.Fatal("PDF was not pinned to its inspected version")
		}
	}
	w = f.request("GET", "/api/issues", nil, nil)
	status(t, w, 200)
	if !strings.Contains(w.Body.String(), `"pdf":"/api/issues/6/pdf"`) {
		t.Fatal("published PDF missing from archive")
	}
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 7}, c), 200)
	upload := f.upload(t, c, 7)
	f.files.objects[upload.Fields["key"]] = Object{Version: "new", Size: 9, ContentType: "application/pdf", Prefix: []byte("%PDF-")}
	status(t, f.request("POST", "/api/uploads/"+upload.ID+"/publish", map[string]string{}, c), 200)
	if err := json.Unmarshal(f.request("GET", "/api/issues", nil, nil).Body.Bytes(), &listing); err != nil {
		t.Fatal(err)
	}
	if listing.Issues[0].Number != 7 {
		t.Fatal("future issue was not added")
	}
}
func TestInvalidUploadsNeverReplacePublishedIssue(t *testing.T) {
	f := setup()
	c := f.login(t)
	original := Record{Number: 6, Key: "original", Version: "safe", Size: 9}
	_ = f.store.Put(context.Background(), "issue", issueID(6), original)
	for _, obj := range []Object{
		{Version: "1", Size: 9, ContentType: "application/pdf", Prefix: []byte("<html")},
		{Version: "1", Size: 9, ContentType: "text/html", Prefix: []byte("%PDF-")},
		{Version: "null", Size: 9, ContentType: "application/pdf", Prefix: []byte("%PDF-")},
		{Version: "1", Size: MaxPDFBytes + 1, ContentType: "application/pdf", Prefix: []byte("%PDF-")},
		{Version: "1", Size: 10, ContentType: "application/pdf", Prefix: []byte("%PDF-")},
	} {
		u := f.upload(t, c, 6)
		f.files.objects[u.Fields["key"]] = obj
		status(t, f.request("POST", "/api/uploads/"+u.ID+"/publish", map[string]string{}, c), 400)
		got, _ := f.store.Get(context.Background(), "issue", issueID(6))
		if got != original {
			t.Fatal("bad upload replaced published PDF")
		}
	}
	for _, n := range []int{0, 10000} {
		status(t, f.request("POST", "/api/uploads", map[string]any{"number": n, "size": 9}, c), 400)
	}
	status(t, f.request("POST", "/api/uploads", map[string]any{"number": 6, "size": MaxPDFBytes + 1}, c), 400)
	u := f.upload(t, c, 6)
	f.now = f.now.Add(16 * time.Minute)
	status(t, f.request("POST", "/api/uploads/"+u.ID+"/publish", map[string]string{}, c), 400)
}

func TestManageIssuesAndRemovePDF(t *testing.T) {
	f := setup()
	for _, route := range []struct{ method, path string }{{"POST", "/api/issues"}, {"DELETE", "/api/issues/6"}, {"DELETE", "/api/issues/6/pdf"}} {
		status(t, f.request(route.method, route.path, map[string]int{"number": 7}, nil), 401)
	}
	c := f.login(t)
	listing := func() []Issue {
		t.Helper()
		var result struct {
			Issues []Issue `json:"issues"`
		}
		w := f.request("GET", "/api/issues", nil, nil)
		status(t, w, 200)
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result.Issues
	}
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 6}, c), 409)
	for _, n := range []int{0, 10000} {
		status(t, f.request("POST", "/api/issues", map[string]int{"number": n}, c), 400)
	}
	status(t, f.request("POST", "/api/uploads", map[string]int{"number": 7, "size": 9}, c), 404)
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 7}, c), 200)
	if rows := listing(); len(rows) != 7 || rows[0].Number != 7 || rows[0].PDF != "" {
		t.Fatalf("new issue: %+v", rows)
	}
	u := f.upload(t, c, 7)
	f.files.objects[u.Fields["key"]] = Object{Version: "first", Size: 9, ContentType: "application/pdf", Prefix: []byte("%PDF-")}
	status(t, f.request("POST", "/api/uploads/"+u.ID+"/publish", map[string]string{}, c), 200)
	status(t, f.request("DELETE", "/api/issues/7/pdf", nil, c), 200)
	if rows := listing(); len(rows) != 7 || rows[0].PDF != "" {
		t.Fatalf("PDF removal deleted row or left link: %+v", rows)
	}
	status(t, f.request("GET", "/api/issues/7/pdf", nil, nil), 404)
	status(t, f.request("DELETE", "/api/issues/7", nil, c), 200)
	status(t, f.request("DELETE", "/api/issues/6", nil, c), 200)
	if rows := listing(); len(rows) != 5 || rows[0].Number != 5 {
		t.Fatalf("deleted default returned: %+v", rows)
	}
	status(t, f.request("DELETE", "/api/issues/6/pdf", nil, c), 404)
	status(t, f.request("POST", "/api/issues", map[string]int{"number": 6}, c), 200)
	if rows := listing(); len(rows) != 6 || rows[0].Number != 6 || rows[0].PDF != "" {
		t.Fatalf("re-add restored old PDF: %+v", rows)
	}
	for n := 1; n <= 6; n++ {
		status(t, f.request("DELETE", fmt.Sprintf("/api/issues/%d", n), nil, c), 200)
	}
	if len(listing()) != 0 {
		t.Fatal("empty archive reintroduced defaults")
	}
}

func TestEditsInvalidatePendingUploads(t *testing.T) {
	for _, path := range []string{"/api/issues/6", "/api/issues/6/pdf"} {
		t.Run(path, func(t *testing.T) {
			f := setup()
			c := f.login(t)
			u := f.upload(t, c, 6)
			f.files.objects[u.Fields["key"]] = Object{Version: "old", Size: 9, ContentType: "application/pdf", Prefix: []byte("%PDF-")}
			status(t, f.request("DELETE", path, nil, c), 200)
			if path == "/api/issues/6" {
				status(t, f.request("POST", "/api/issues", map[string]int{"number": 6}, c), 200)
			}
			status(t, f.request("POST", "/api/uploads/"+u.ID+"/publish", map[string]string{}, c), 409)
			status(t, f.request("GET", "/api/issues/6/pdf", nil, nil), 404)
		})
	}
}

func TestCrossOriginAPI(t *testing.T) {
	f := setup()
	for _, tc := range []struct {
		name, origin, method, requestedMethod, headers string
		want                                           int
	}{
		{"read", f.server.Origin, "GET", "", "", 200},
		{"direct read", "", "GET", "", "", 200},
		{"preflight login", f.server.Origin, "OPTIONS", "POST", "content-type", 204},
		{"preflight delete", f.server.Origin, "OPTIONS", "DELETE", "", 204},
		{"foreign read", "https://evil.example.test", "GET", "", "", 403},
		{"foreign preflight", "https://evil.example.test", "OPTIONS", "POST", "content-type", 403},
		{"missing origin", "", "OPTIONS", "POST", "content-type", 403},
		{"unsupported method", f.server.Origin, "OPTIONS", "PATCH", "", 403},
		{"unsupported header", f.server.Origin, "OPTIONS", "POST", "x-untrusted", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, "https://api.bugle.example.test/api/issues", nil)
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Access-Control-Request-Method", tc.requestedMethod)
			r.Header.Set("Access-Control-Request-Headers", tc.headers)
			w := httptest.NewRecorder()
			f.server.Handler().ServeHTTP(w, r)
			status(t, w, tc.want)
			if tc.origin == f.server.Origin {
				if w.Header().Get("Access-Control-Allow-Origin") != tc.origin || w.Header().Get("Access-Control-Allow-Credentials") != "true" {
					t.Fatal("missing credentialed CORS headers")
				}
			} else if w.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("allowed untrusted origin")
			}
		})
	}
	// Errors must also be readable by the trusted frontend, including expired sessions.
	w := f.request("DELETE", "/api/issues/6", nil, nil)
	status(t, w, 401)
	if w.Header().Get("Access-Control-Allow-Origin") != f.server.Origin {
		t.Fatal("error response omitted CORS")
	}
}
