package selenium_test

import (
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestAvailabilityPageHydratesCalendarRenderer(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	root.Path = "/availability"

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(root.String()); err != nil {
		t.Fatalf("navigate availability page: %v", err)
	}

	if _, err := driver.FindElement(selenium.ByXPATH, "//*[contains(text(), 'Thomas') and contains(text(), 'availability')]"); err != nil {
		t.Fatalf("availability heading not visible: %v", err)
	}

	if _, err := waitForElement(driver, selenium.ByCSSSelector, "[data-availability-state]", 30*time.Second); err != nil {
		t.Fatalf("availability client did not hydrate: %v", err)
	}

	if _, err := waitForAvailabilityState(driver, "ready", 30*time.Second); err != nil {
		body, _ := driver.PageSource()
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("availability calendar did not become ready: %v (logs: %+v, body: %s)", err, filterErrorsWeDontCareAbout(browserLogs), body)
	}

	if _, err := waitForElement(driver, selenium.ByCSSSelector, "[data-availability-busy]", 10*time.Second); err != nil {
		text, _ := driver.ExecuteScript("return document.body ? document.body.innerText : ''", nil)
		counts, _ := driver.ExecuteScript("return {busy: document.querySelectorAll('[data-availability-busy]').length, state: document.querySelector('[data-availability-state]')?.getAttribute('data-availability-state')};", nil)
		resources, _ := driver.ExecuteScript("return performance.getEntriesByType('resource').map(e => e.name).filter(name => name.includes('/calendar/ical/') || name.includes('calendar.google.com'));", nil)
		t.Fatalf("availability page did not render any busy blocks: %v (text: %v, counts: %v, resources: %v)", err, text, counts, resources)
	}

	if _, err := waitForElement(driver, selenium.ByCSSSelector, "[data-availability-day-header] sup", 10*time.Second); err != nil {
		headers, _ := driver.ExecuteScript("return [...document.querySelectorAll('[data-availability-day-header]')].map(header => header.innerHTML);", nil)
		t.Fatalf("availability day headers did not render ordinal superscripts: %v (headers: %v)", err, headers)
	}

	if _, err := driver.FindElement(selenium.ByCSSSelector, "iframe"); err == nil {
		t.Fatalf("availability page rendered an iframe")
	}

	logs, err := driver.Log(log.Browser)
	if err != nil {
		t.Fatalf("browser logs: %v", err)
	}
	if filtered := filterErrorsWeDontCareAbout(logs); len(filtered) > 0 {
		t.Fatalf("availability page logged browser errors: %+v", filtered)
	}
}

func TestAvailabilityPageHydratesInBerlinLocale(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	root.Path = "/availability"

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.SetTimezoneOverride("Europe/Berlin"); err != nil {
		t.Fatalf("set timezone override: %v", err)
	}
	if err := driver.SetLocaleOverride("de-DE"); err != nil {
		t.Fatalf("set locale override: %v", err)
	}

	if err := driver.Get(root.String()); err != nil {
		t.Fatalf("navigate availability page: %v", err)
	}
	if _, err := waitForAvailabilityState(driver, "ready", 30*time.Second); err != nil {
		body, _ := driver.PageSource()
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("availability calendar did not become ready in Berlin locale: %v (logs: %+v, body: %s)", err, filterErrorsWeDontCareAbout(browserLogs), body)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "[data-availability-busy]", 10*time.Second); err != nil {
		body, _ := driver.PageSource()
		t.Fatalf("availability page did not render busy blocks in Berlin locale: %v (body: %s)", err, body)
	}

	logs, err := driver.Log(log.Browser)
	if err != nil {
		t.Fatalf("browser logs: %v", err)
	}
	if filtered := filterErrorsWeDontCareAbout(logs); len(filtered) > 0 {
		t.Fatalf("availability page logged browser errors in Berlin locale: %+v", filtered)
	}
}

func TestAvailabilityPageStreamsCalendarEvents(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	root.Path = "/availability"

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.ExecuteChromiumCommand("Page.addScriptToEvaluateOnNewDocument", map[string]any{
		"source": `
			(() => {
				const realFetch = window.fetch.bind(window);
				let calendarFetches = 0;
				const formatICalDate = date => date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
				const calendarBody = () => {
					const startsAt = new Date();
					startsAt.setUTCMinutes(0, 0, 0);
					startsAt.setUTCHours(startsAt.getUTCHours() + 2);
					const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
					return [
						'BEGIN:VCALENDAR',
						'BEGIN:VEVENT',
						` + "`DTSTART:${formatICalDate(startsAt)}`" + `,
						` + "`DTEND:${formatICalDate(endsAt)}`" + `,
						'END:VEVENT',
						'END:VCALENDAR',
					].join('\r\n');
				};

				window.fetch = (input, init) => {
					const url = typeof input === 'string'
						? input
						: input instanceof URL
							? input.toString()
							: input.url;
					if (!url.includes('/calendar/ical/')) {
						return realFetch(input, init);
					}

					calendarFetches += 1;
					const response = () => new Response(calendarBody(), {
						headers: { 'Content-Type': 'text/calendar' },
						status: 200,
					});

					if (calendarFetches === 1) {
						return Promise.resolve(response());
					}

					return new Promise(resolve => {
						setTimeout(() => resolve(response()), 5000);
					});
				};
			})();
		`,
	}); err != nil {
		t.Fatalf("install delayed calendar fetch fixture: %v", err)
	}

	if err := driver.Get(root.String()); err != nil {
		t.Fatalf("navigate availability page: %v", err)
	}

	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		result, err := wd.ExecuteScript(`
			return {
				busy: document.querySelectorAll('[data-availability-busy]').length,
				state: document.querySelector('[data-availability-state]')?.getAttribute('data-availability-state'),
			};
		`, nil)
		if err != nil {
			return false, err
		}
		values, ok := result.(map[string]any)
		if !ok {
			return false, nil
		}
		busy, _ := values["busy"].(float64)
		return busy > 0 && values["state"] == "ready", nil
	}, 3*time.Second); err != nil {
		body, _ := driver.PageSource()
		t.Fatalf("availability page did not render early calendar events before delayed feeds resolved: %v (body: %s)", err, body)
	}

	if _, err := waitForAvailabilityState(driver, "ready", 10*time.Second); err != nil {
		body, _ := driver.PageSource()
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("availability calendar did not finish after delayed feeds resolved: %v (logs: %+v, body: %s)", err, filterErrorsWeDontCareAbout(browserLogs), body)
	}
}

func TestAvailabilityDayHeadersStickToViewport(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	root.Path = "/availability"

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(root.String()); err != nil {
		t.Fatalf("navigate availability page: %v", err)
	}
	if _, err := waitForAvailabilityState(driver, "ready", 30*time.Second); err != nil {
		body, _ := driver.PageSource()
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("availability calendar did not become ready: %v (logs: %+v, body: %s)", err, filterErrorsWeDontCareAbout(browserLogs), body)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "[data-availability-busy]", 10*time.Second); err != nil {
		body, _ := driver.PageSource()
		t.Fatalf("availability page did not render busy blocks: %v (body: %s)", err, body)
	}

	result, err := driver.ExecuteScript(`
		const week = document.querySelector('[aria-label="Availability this week"]');
		const header = document.querySelector('[data-availability-day-header]');
		if (!week || !header) return {missing: true};
		const y = week.getBoundingClientRect().top + window.scrollY + 500;
		window.scrollTo(0, y);
		const weekStyle = getComputedStyle(week);
		return {
			headerTop: header.getBoundingClientRect().top,
			missing: false,
			overflowY: weekStyle.overflowY,
			pageScrollTop: document.scrollingElement.scrollTop,
			weekScrollTop: week.scrollTop,
		};
	`, nil)
	if err != nil {
		t.Fatalf("check sticky day header: %v", err)
	}

	values, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("unexpected sticky header result: %#v", result)
	}
	if values["missing"] == true {
		t.Fatalf("availability table/header missing after render: %#v", values)
	}
	if values["overflowY"] != "visible" {
		t.Fatalf("availability table should not be a vertical scroll container: %#v", values)
	}
	if values["weekScrollTop"] != float64(0) {
		t.Fatalf("availability table scrolled independently of the page: %#v", values)
	}
	headerTop, ok := values["headerTop"].(float64)
	if !ok {
		t.Fatalf("unexpected sticky header top: %#v", values)
	}
	if headerTop < -1 || headerTop > 1 {
		t.Fatalf("day header did not stick to viewport top: %#v", values)
	}
}

func waitForAvailabilityState(driver selenium.WebDriver, want string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		elem, err := driver.FindElement(selenium.ByCSSSelector, "[data-availability-state]")
		if err == nil {
			state, err := elem.GetAttribute("data-availability-state")
			if err == nil && state == want {
				return state, nil
			}
			if state == "error" {
				return state, errAvailabilityState(state)
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return "", errAvailabilityState("timed out")
}

type errAvailabilityState string

func (err errAvailabilityState) Error() string {
	return "availability state: " + string(err)
}
