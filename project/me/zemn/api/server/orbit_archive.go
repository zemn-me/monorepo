package apiserver

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"golang.org/x/sync/singleflight"
)

type orbitArchive struct {
	bucket  string
	objects JournalObjectStore
	client  *http.Client
	loads   singleflight.Group
}

type orbitDay struct {
	compressed []byte
	expires    time.Time
}

func orbitExpiry(day, fetched time.Time, empty bool) time.Time {
	// A file fetched while the day was still being filled must be refreshed
	// before it can qualify for the historical TTL.
	if empty || fetched.Before(day.AddDate(0, 0, 7)) {
		return fetched.Add(15 * time.Minute)
	}
	return fetched.Add(365 * 24 * time.Hour)
}

func (d orbitDay) VisitGetOrbitElementsResponse(w http.ResponseWriter) error {
	seconds := max(0, int(time.Until(d.expires).Seconds()))
	w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", seconds))
	if len(d.compressed) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Encoding", "gzip")
	_, err := w.Write(d.compressed)
	return err
}

type orbitError int

func (e orbitError) VisitGetOrbitElementsResponse(w http.ResponseWriter) error {
	w.Header().Set("Cache-Control", "no-store")
	http.Error(w, http.StatusText(int(e)), int(e))
	return nil
}

func (s *Server) GetOrbitElements(ctx context.Context, req GetOrbitElementsRequestObject) (GetOrbitElementsResponseObject, error) {
	day, err := time.Parse(time.DateOnly, req.Day)
	if err != nil || day.Year() < 1957 || day.After(time.Now()) {
		return orbitError(http.StatusBadRequest), nil
	}
	result := s.orbitArchive.loads.DoChan(req.Day, func() (any, error) {
		// A second reader may still need this file after the first one cancels.
		load, cancel := context.WithTimeout(context.WithoutCancel(ctx), 25*time.Second)
		defer cancel()
		return s.orbitArchive.load(load, day)
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-result:
		if res.Err != nil {
			s.log.Printf("orbit archive %s: %v", req.Day, res.Err)
			return orbitError(http.StatusBadGateway), nil
		}
		return res.Val.(orbitDay), nil
	}
}

func (a *orbitArchive) load(ctx context.Context, day time.Time) (orbitDay, error) {
	key := "tle/" + day.Format(time.DateOnly) + ".gz"
	cached, err := a.objects.GetObject(ctx, &s3.GetObjectInput{Bucket: &a.bucket, Key: &key})
	if err == nil {
		defer cached.Body.Close()
		expires := orbitExpiry(day, aws.ToTime(cached.LastModified), aws.ToInt64(cached.ContentLength) == 0)
		if time.Now().Before(expires) {
			body, err := io.ReadAll(cached.Body)
			return orbitDay{body, expires}, err
		}
	} else {
		var missing *s3types.NoSuchKey
		if !errors.As(err, &missing) && !errors.Is(err, os.ErrNotExist) {
			return orbitDay{}, err
		}
	}

	body, err := a.fetch(ctx, day)
	if err != nil {
		return orbitDay{}, err
	}
	_, err = a.objects.PutObject(ctx, &s3.PutObjectInput{
		Bucket: &a.bucket, Key: &key, Body: bytes.NewReader(body),
		ContentType: aws.String("application/gzip"),
	})
	return orbitDay{body, orbitExpiry(day, time.Now(), len(body) == 0)}, err
}

var orbitElementPair = regexp.MustCompile(`(?m)^1 .{5}[^\r\n]*\r?\n2 `)

func (a *orbitArchive) fetch(ctx context.Context, day time.Time) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://spacebook.com/api/entity/tle/"+day.Format(time.DateOnly), nil)
	if err != nil {
		return nil, err
	}
	res, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusNoContent {
		return nil, nil
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Spacebook returned %s", res.Status)
	}
	const maxBytes = 32 << 20
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}
	if len(raw) > maxBytes || !orbitElementPair.Match(raw) {
		return nil, errors.New("invalid Spacebook archive")
	}
	var out bytes.Buffer
	zw := gzip.NewWriter(&out)
	if _, err := zw.Write(raw); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
