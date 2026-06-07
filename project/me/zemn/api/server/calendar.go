package apiserver

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type calendarICalFetcher func(ctx context.Context, email string) (string, error)

//go:embed calendar_emails.json
var calendarEmailsJSON []byte

func allowedCalendarEmails() map[string]struct{} {
	var emails []string
	if err := json.Unmarshal(calendarEmailsJSON, &emails); err != nil {
		panic(fmt.Errorf("parse embedded calendar email allowlist: %w", err))
	}

	allowed := make(map[string]struct{}, len(emails))
	for _, email := range emails {
		allowed[canonicalCalendarEmail(email)] = struct{}{}
	}
	return allowed
}

var calendarEmailAllowlist = allowedCalendarEmails()

func canonicalCalendarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func isAllowedCalendarEmail(email string) bool {
	_, ok := calendarEmailAllowlist[canonicalCalendarEmail(email)]
	return ok
}

func defaultCalendarICalFetcher() calendarICalFetcher {
	if os.Getenv("ZEMN_TEST_CALENDAR_ICAL_ROLLING_FIXTURE") != "" {
		return func(_ context.Context, _ string) (string, error) {
			return rollingCalendarFixture(time.Now()), nil
		}
	}

	if fixture := os.Getenv("ZEMN_TEST_CALENDAR_ICAL_FILE"); fixture != "" {
		return func(_ context.Context, _ string) (string, error) {
			body, err := os.ReadFile(fixture)
			if err != nil {
				return "", err
			}
			return string(body), nil
		}
	}

	return fetchGoogleCalendarICal
}

func rollingCalendarFixture(now time.Time) string {
	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//zemn.me//availability integration fixture//EN\n")

	startDay := time.Date(
		now.UTC().Year(),
		now.UTC().Month(),
		now.UTC().Day(),
		16,
		0,
		0,
		0,
		time.UTC,
	).AddDate(0, 0, -14)

	for i := 0; i < 29; i++ {
		startsAt := startDay.AddDate(0, 0, i)
		endsAt := startsAt.Add(time.Hour)
		fmt.Fprintf(
			&b,
			"BEGIN:VEVENT\nUID:availability-integration-%d@example.com\nDTSTART:%s\nDTEND:%s\nEND:VEVENT\n",
			i,
			startsAt.Format("20060102T150405Z"),
			endsAt.Format("20060102T150405Z"),
		)
	}

	b.WriteString("END:VCALENDAR\n")
	return b.String()
}

func fetchGoogleCalendarICal(ctx context.Context, email string) (string, error) {
	u := fmt.Sprintf(
		"https://calendar.google.com/calendar/ical/%s/public/basic.ics",
		url.PathEscape(email),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("calendar upstream returned %d: %s", resp.StatusCode, string(body))
	}

	return string(body), nil
}

func (s *Server) GetCalendarIcalEmail(ctx context.Context, rq GetCalendarIcalEmailRequestObject) (GetCalendarIcalEmailResponseObject, error) {
	if !isAllowedCalendarEmail(rq.Email) {
		return GetCalendarIcalEmail404TextResponse("calendar not found"), nil
	}

	fetch := s.fetchCalendarICal
	if fetch == nil {
		fetch = defaultCalendarICalFetcher()
	}

	body, err := fetch(ctx, rq.Email)
	if err != nil {
		return GetCalendarIcalEmail502TextResponse(err.Error()), nil
	}

	return GetCalendarIcalEmail200TextResponse(body), nil
}
