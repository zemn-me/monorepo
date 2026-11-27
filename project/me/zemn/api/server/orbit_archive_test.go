package apiserver

import (
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOrbitArchiveHTTP(t *testing.T) {
	const pair = "1 00005U 58002B   06211.82084541  .00000209  00000-0  23809-3 0   988\n2 00005  34.2592 354.7131 1852499 234.8007 106.4984 10.83903604654908\n"
	const day = "2006-08-01"
	const site = "http://localhost:4867"
	t.Setenv("OAUTH_FRONTEND_ORIGIN", site)
	tle := strings.Repeat(pair, 20)
	for _, tc := range []struct {
		name, body       string
		upstream, status int
	}{
		{"archive", tle, 200, 200},
		{"missing", "", 404, 204},
		{"no content", "", 204, 204},
		{"empty", "\n", 200, 204},
		{"unavailable", "", 503, 502},
		{"invalid", "<html>error</html>", 200, 502},
	} {
		t.Run(tc.name, func(t *testing.T) {
			transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
					t.Error("forwarded viewer credentials to Spacebook")
				}
				if r.URL.String() != "https://spacebook.com/api/entity/tle/"+day {
					t.Errorf("upstream: %s", r.URL)
				}
				return &http.Response{StatusCode: tc.upstream, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})
			s, err := NewServer(t.Context(), NewServerOptions{OrbitElementsTransport: transport})
			if err != nil {
				t.Fatal(err)
			}
			for _, viewer := range []struct{ origin, accept, encoding string }{
				{"", "", ""},
				{site, "br, gzip", "gzip"},
				{"https://elsewhere.example", "gzip;q=0", ""},
			} {
				r := httptest.NewRequest("GET", "/earth-orbits/elements/"+day, nil)
				r.Header.Set("Origin", viewer.origin)
				r.Header.Set("Accept-Encoding", viewer.accept)
				r.Header.Set("Cookie", "session=viewer")
				r.Header.Set("Authorization", "Bearer viewer")
				w := httptest.NewRecorder()
				s.ServeHTTP(w, r)
				if w.Code != tc.status || w.Header().Get("Access-Control-Allow-Origin") != site {
					t.Fatalf("status %d headers %v", w.Code, w.Header())
				}
				cache := w.Header().Get("Cache-Control")
				if tc.status == 502 {
					if cache != "no-store" {
						t.Fatal(cache)
					}
					continue
				}
				var seconds int
				if _, err := fmt.Sscanf(cache, "public, max-age=%d", &seconds); err != nil {
					t.Fatal(cache)
				}
				if tc.status == 204 {
					if seconds <= 0 || seconds > 900 || w.Body.Len() != 0 {
						t.Fatalf("missing response %s body %d", cache, w.Body.Len())
					}
					continue
				}
				if seconds < 364*86400 || w.Header().Get("Content-Encoding") != viewer.encoding {
					t.Fatal(w.Header())
				}
				var body io.Reader = w.Body
				if viewer.encoding == "gzip" {
					z, err := gzip.NewReader(body)
					if err != nil {
						t.Fatal(err)
					}
					defer z.Close()
					body = z
				}
				data, err := io.ReadAll(body)
				if err != nil || string(data) != tle {
					t.Fatalf("archive bytes: %v", err)
				}
			}
		})
	}
}

func TestOrbitArchivePreflight(t *testing.T) {
	for _, site := range []string{"https://zemn.me", "https://staging.zemn.me", "http://localhost:49822"} {
		t.Setenv("OAUTH_FRONTEND_ORIGIN", site)
		s, err := NewServer(t.Context(), NewServerOptions{})
		if err != nil {
			t.Fatal(err)
		}
		for _, tc := range []struct{ origin, want string }{{site, site}, {"https://unrelated.example", ""}} {
			r := httptest.NewRequest(http.MethodOptions, "/earth-orbits/elements/2006-08-01", nil)
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Access-Control-Request-Method", "GET")
			w := httptest.NewRecorder()
			s.ServeHTTP(w, r)
			if got := w.Header().Get("Access-Control-Allow-Origin"); got != tc.want {
				t.Errorf("site %s, origin %s: got %q, want %q", site, tc.origin, got, tc.want)
			}
		}
	}
}

func TestOrbitArchiveTTLAndDateBounds(t *testing.T) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	// A partial file fetched on its own date must not become a year-long cache hit later.
	if got := orbitMaxAge(today, today, false); got != 15*time.Minute {
		t.Fatal(got)
	}
	if got := orbitMaxAge(today.AddDate(0, 0, -8), today, false); got != 365*24*time.Hour {
		t.Fatal(got)
	}
	s := &Server{}
	for _, invalid := range []string{"yesterday", "1956-12-31", "2025-02-30", today.AddDate(0, 0, 1).Format(time.DateOnly)} {
		res, err := s.GetOrbitElements(t.Context(), GetOrbitElementsRequestObject{Day: invalid})
		if err != nil || res != orbitError(400) {
			t.Fatalf("accepted date %s", invalid)
		}
	}
}
