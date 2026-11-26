package apiserver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"golang.org/x/sync/singleflight"
)

type orbitArchive struct {
	client *http.Client
	loads  singleflight.Group
}

type orbitDay struct {
	elements []byte
	maxAge   time.Duration
}

func orbitMaxAge(day, fetched time.Time, empty bool) time.Duration {
	// A file fetched while the day was still being filled must be refreshed
	// before it can qualify for the historical TTL.
	if empty || fetched.Before(day.AddDate(0, 0, 7)) {
		return 15 * time.Minute
	}
	return 365 * 24 * time.Hour
}

func (d orbitDay) VisitGetOrbitElementsResponse(w http.ResponseWriter) error {
	seconds := int(d.maxAge.Seconds())
	w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", seconds))
	if len(d.elements) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(d.elements)))
	_, err := w.Write(d.elements)
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
		body, err := s.orbitArchive.fetch(load, day)
		return orbitDay{elements: body, maxAge: orbitMaxAge(day, time.Now(), len(body) == 0)}, err
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
	return raw, nil
}
