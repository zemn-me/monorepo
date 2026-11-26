package apiserver

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type orbitTestObjects struct {
	fakeJournalObjects
	modified time.Time
}

func (f *orbitTestObjects) GetObject(ctx context.Context, input *s3.GetObjectInput, opts ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if _, exists := f.objects[*input.Key]; !exists {
		return nil, &s3types.NoSuchKey{}
	}
	out, err := f.fakeJournalObjects.GetObject(ctx, input, opts...)
	out.LastModified = &f.modified
	return out, err
}

func TestOrbitArchiveHTTP(t *testing.T) {
	const tle = "1 00005U 58002B   06211.82084541  .00000209  00000-0  23809-3 0   988\n2 00005  34.2592 354.7131 1852499 234.8007 106.4984 10.83903604654908\n"
	const day = "2006-08-01"
	for _, tc := range []struct {
		name, body              string
		upstream, status, calls int
	}{
		{"archive", tle, 200, 200, 1},
		{"missing", "", 404, 204, 1},
		{"no content", "", 204, 204, 1},
		{"empty", "\n", 200, 204, 1},
		{"unavailable", "", 503, 502, 2},
		{"invalid", "<html>error</html>", 200, 502, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &orbitTestObjects{modified: time.Now()}
			calls := 0
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				calls++
				if r.URL.String() != "https://spacebook.com/api/entity/tle/"+day {
					t.Errorf("upstream: %s", r.URL)
				}
				return &http.Response{StatusCode: tc.upstream, Body: io.NopCloser(strings.NewReader(tc.body))}, nil
			})}
			// Separate API instances must share the on-demand cache.
			for range 2 {
				s, err := NewServer(t.Context(), NewServerOptions{JournalObjects: store})
				if err != nil {
					t.Fatal(err)
				}
				s.orbitArchive.client = client
				s.orbitArchive.bucket = "orbit-test"
				r := httptest.NewRequest("GET", "/earth-orbits/elements/"+day, nil)
				r.Header.Set("Origin", "https://zemn.me")
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
			if calls != tc.calls {
				t.Fatalf("Spacebook requests %d, want %d", calls, tc.calls)
			}
		})
	}
}

func TestOrbitArchiveRefresh(t *testing.T) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	// A partial file fetched on its own date must not become a year-long cache hit later.
	if got := orbitExpiry(today, today, false).Sub(today); got != 15*time.Minute {
		t.Fatal(got)
	}
	if got := orbitExpiry(today.AddDate(0, 0, -8), today, false).Sub(today); got != 365*24*time.Hour {
		t.Fatal(got)
	}
	storage := &orbitTestObjects{modified: time.Now().Add(-time.Hour)}
	day := today.AddDate(0, 0, -30)
	storage.objects = map[string][]byte{"tle/" + day.Format(time.DateOnly) + ".gz": nil}
	fetched := false
	archive := orbitArchive{objects: storage, bucket: "test", client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		fetched = true
		return &http.Response{StatusCode: 404, Body: http.NoBody}, nil
	})}}
	if _, err := archive.load(t.Context(), day); err != nil || !fetched {
		t.Fatalf("expired miss did not refresh: %v", err)
	}
	s := &Server{}
	for _, invalid := range []string{"yesterday", "1956-12-31", "2025-02-30", today.AddDate(0, 0, 1).Format(time.DateOnly)} {
		res, err := s.GetOrbitElements(t.Context(), GetOrbitElementsRequestObject{Day: invalid})
		if err != nil || res != orbitError(400) {
			t.Fatalf("accepted date %s", invalid)
		}
	}
}
