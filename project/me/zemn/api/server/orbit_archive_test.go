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
	const tle = "1 00005U 58002B   06211.82084541  .00000209  00000-0  23809-3 0   988\n2 00005  34.2592 354.7131 1852499 234.8007 106.4984 10.83903604654908\n"
	const day = "2006-08-01"
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
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
					t.Error("forwarded viewer credentials to Spacebook")
				}
				if r.URL.String() != "https://spacebook.com/api/entity/tle/"+day {
					t.Errorf("upstream: %s", r.URL)
				}
				return &http.Response{StatusCode: tc.upstream, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})}
			for _, origin := range []string{"", "https://zemn.me"} {
				s, err := NewServer(t.Context(), NewServerOptions{})
				if err != nil {
					t.Fatal(err)
				}
				s.orbitArchive.client = client
				r := httptest.NewRequest("GET", "/earth-orbits/elements/"+day, nil)
				r.Header.Set("Origin", origin)
				r.Header.Set("Cookie", "session=viewer")
				r.Header.Set("Authorization", "Bearer viewer")
				w := httptest.NewRecorder()
				s.ServeHTTP(w, r)
				if w.Code != tc.status || w.Header().Get("Access-Control-Allow-Origin") != "*" {
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
				if seconds < 364*86400 || w.Header().Get("Content-Encoding") != "gzip" {
					t.Fatal(w.Header())
				}
				z, err := gzip.NewReader(w.Body)
				if err != nil {
					t.Fatal(err)
				}
				data, err := io.ReadAll(z)
				if err != nil || string(data) != tle {
					t.Fatalf("archive bytes: %v", err)
				}
				z.Close()
			}
		})
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
