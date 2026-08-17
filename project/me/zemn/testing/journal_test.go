package selenium_test

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/tebeka/selenium"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	apiserver "github.com/zemn-me/monorepo/project/me/zemn/api/server"
)

func TestJournalEndToEndInDevServer(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	const pendingEntryID = "00000000-0000-4000-8000-000000000001"
	const failedEntryID = "00000000-0000-4000-8000-000000000002"
	if err := putProcessingJournalEntry(t.Context(), pendingEntryID); err != nil {
		t.Fatalf("seed processing journal entry: %v", err)
	}
	if err := putJournalEntry(t.Context(), failedEntryID, apiserver.JournalEntryStatusFailed); err != nil {
		t.Fatalf("seed failed journal entry: %v", err)
	}
	t.Cleanup(func() {
		_ = deleteJournalEntry(context.Background(), pendingEntryID)
		_ = deleteJournalEntry(context.Background(), failedEntryID)
	})

	driver, err := seleniumpkg.NewWithChromeArguments(
		"--use-fake-device-for-media-stream",
		"--use-fake-ui-for-media-stream",
	)
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()
	if err := driver.SetTimezoneOverride("America/Los_Angeles"); err != nil {
		t.Fatalf("set journal browser time zone: %v", err)
	}

	journalURL := root
	journalURL.Path = "/journal"
	if err := driver.Get(journalURL.String()); err != nil {
		t.Fatalf("navigate journal: %v", err)
	}
	if _, err := driver.FindElement(selenium.ByCSSSelector, "[data-glade-layout]"); err != nil {
		t.Fatalf("journal does not use shared site layout: %v", err)
	}
	allowsJournalObjectStorage, err := driver.ExecuteScript(`
		const policy = document.querySelector(
			"meta[http-equiv='Content-Security-Policy']",
		)?.content ?? '';
		const directives = new Map(policy.split(';').map((directive) => {
			const [name, ...sources] = directive.trim().split(/\s+/);
			return [name, new Set(sources)];
		}));
		const regionalS3 = 'https://s3.us-east-1.amazonaws.com';
		return directives.get('connect-src')?.has(regionalS3) === true &&
			directives.get('media-src')?.has(regionalS3) === true;
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal object-storage CSP: %v", err)
	}
	if allowsJournalObjectStorage != true {
		t.Fatalf("journal CSP does not allow direct uploads to and playback from regional S3")
	}
	usesSiteFont, err := driver.ExecuteScript(`
		const page = document.querySelector('[data-glade-content] > main');
		return page !== null &&
			getComputedStyle(page).fontFamily === getComputedStyle(document.body).fontFamily;
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal typography: %v", err)
	}
	if usesSiteFont != true {
		t.Fatalf("journal does not inherit the site typeface")
	}
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatalf("oidc login: %v", err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 30*time.Second); err != nil {
		t.Fatalf("journal did not become writable: %v", err)
	}
	usesMatchingIconControls, err := driver.ExecuteScript(`
		const record = document.querySelector("button[aria-label='Record a note']");
		const input = document.querySelector("input[aria-label='Import voice memo']");
		const importControl = input?.closest('label');
		return record !== null && importControl !== null &&
			importControl.textContent.trim() === '' &&
			Math.abs(record.getBoundingClientRect().height -
				importControl.getBoundingClientRect().height) < 0.5;
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal icon controls: %v", err)
	}
	if usesMatchingIconControls != true {
		t.Fatalf("journal import control is not an icon-only match for record")
	}
	if _, err := waitForElement(driver, selenium.ByXPATH, "//nav[@aria-label='Journal zoom']/p[normalize-space()='Overview']", 30*time.Second); err != nil {
		t.Fatalf("journal did not default to its overview: %v", err)
	}
	failedEntries, err := driver.FindElements(selenium.ByID, "entry-"+failedEntryID)
	if err != nil {
		t.Fatalf("inspect failed journal entries: %v", err)
	}
	if len(failedEntries) != 0 {
		t.Fatalf("failed journal entry was displayed in the index")
	}
	pendingEntryStatus, err := waitForElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//details[@id='entry-%s']//span[normalize-space()='Transcribing voice note…']", pendingEntryID),
		30*time.Second,
	)
	if err != nil {
		t.Fatalf("existing processing journal entry was not shown: %v", err)
	}
	pendingEntrySummary, err := pendingEntryStatus.FindElement(selenium.ByXPATH, "ancestor::summary")
	if err != nil {
		t.Fatalf("find processing journal entry summary: %v", err)
	}
	if err := pendingEntrySummary.Click(); err != nil {
		t.Fatalf("open processing journal entry: %v", err)
	}
	if _, err := waitForElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//details[@id='entry-%s' and @open]/p[@role='status' and normalize-space()='Transcribing voice note…']", pendingEntryID),
		10*time.Second,
	); err != nil {
		t.Fatalf("opened processing journal entry did not show transcription status: %v", err)
	}
	if err := deleteJournalEntry(t.Context(), pendingEntryID); err != nil {
		t.Fatalf("remove processing journal fixture: %v", err)
	}
	if err := waitForNoElement(
		driver,
		selenium.ByID,
		"entry-"+pendingEntryID,
		30*time.Second,
	); err != nil {
		t.Fatalf("processing journal entry did not disappear after polling: %v", err)
	}

	audio := testWAV()
	file, err := os.CreateTemp(t.TempDir(), "journal-*.wav")
	if err != nil {
		t.Fatalf("create test voice memo: %v", err)
	}
	if _, err := file.Write(audio); err != nil {
		t.Fatalf("write test voice memo: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close test voice memo: %v", err)
	}
	completedYearRecordingTime := time.Date(
		2025,
		time.August,
		13,
		19,
		16,
		0,
		0,
		time.FixedZone("PDT", -7*60*60),
	)
	if err := os.Chtimes(file.Name(), completedYearRecordingTime, completedYearRecordingTime); err != nil {
		t.Fatalf("date test voice memo in a completed year: %v", err)
	}
	secondAudio := append([]byte(nil), audio...)
	secondAudio[len(secondAudio)-1] = 1
	secondFile, err := os.CreateTemp(t.TempDir(), "journal-second-*.wav")
	if err != nil {
		t.Fatalf("create second test voice memo: %v", err)
	}
	if _, err := secondFile.Write(secondAudio); err != nil {
		t.Fatalf("write second test voice memo: %v", err)
	}
	if err := secondFile.Close(); err != nil {
		t.Fatalf("close second test voice memo: %v", err)
	}
	if err := os.Chtimes(secondFile.Name(), completedYearRecordingTime, completedYearRecordingTime); err != nil {
		t.Fatalf("date second test voice memo in a completed year: %v", err)
	}
	thirdAudio := append([]byte(nil), audio...)
	thirdAudio[len(thirdAudio)-2] = 1
	thirdFile, err := os.CreateTemp(t.TempDir(), "journal-third-*.wav")
	if err != nil {
		t.Fatalf("create third test voice memo: %v", err)
	}
	if _, err := thirdFile.Write(thirdAudio); err != nil {
		t.Fatalf("write third test voice memo: %v", err)
	}
	if err := thirdFile.Close(); err != nil {
		t.Fatalf("close third test voice memo: %v", err)
	}
	previousDayRecordingTime := completedYearRecordingTime.AddDate(0, 0, -1)
	if err := os.Chtimes(thirdFile.Name(), previousDayRecordingTime, previousDayRecordingTime); err != nil {
		t.Fatalf("date third test voice memo on the previous day: %v", err)
	}
	fourthAudio := append([]byte(nil), audio...)
	fourthAudio[len(fourthAudio)-3] = 1
	fourthFile, err := os.CreateTemp(t.TempDir(), "journal-fourth-*.wav")
	if err != nil {
		t.Fatalf("create fourth test voice memo: %v", err)
	}
	if _, err := fourthFile.Write(fourthAudio); err != nil {
		t.Fatalf("write fourth test voice memo: %v", err)
	}
	if err := fourthFile.Close(); err != nil {
		t.Fatalf("close fourth test voice memo: %v", err)
	}
	previousMonthRecordingTime := completedYearRecordingTime.AddDate(0, -1, 0)
	if err := os.Chtimes(fourthFile.Name(), previousMonthRecordingTime, previousMonthRecordingTime); err != nil {
		t.Fatalf("date fourth test voice memo in the previous month: %v", err)
	}
	if _, err := driver.ExecuteScript(`
		const transfer = new DataTransfer();
		transfer.items.add(new File([], 'empty.wav', { type: 'audio/wav' }));
		for (const type of ['dragenter', 'dragover', 'drop']) {
			document.dispatchEvent(new DragEvent(type, {
				bubbles: true,
				cancelable: true,
				dataTransfer: transfer,
			}));
		}
	`, nil); err != nil {
		t.Fatalf("submit invalid voice memo: %v", err)
	}
	const staleUploadError = "Voice notes must be between 1 byte and 25 MiB."
	if err := waitForText(driver, staleUploadError, 10*time.Second); err != nil {
		t.Fatalf("invalid voice memo error: %v", err)
	}
	if err := waitForNoElement(driver, selenium.ByXPATH, fmt.Sprintf("//*[normalize-space()='%s']", staleUploadError), 12*time.Second); err != nil {
		t.Fatalf("upload error did not dismiss itself: %v", err)
	}

	if err := dispatchJournalFile(driver, file.Name(), "drop"); err != nil {
		t.Fatalf("drop voice memo: %v", err)
	}
	if err := dispatchJournalFile(driver, file.Name(), "paste"); err != nil {
		t.Fatalf("paste voice memo: %v", err)
	}
	importInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 10*time.Second)
	if err != nil {
		t.Fatalf("find journal import input: %v", err)
	}
	multiple, err := importInput.GetAttribute("multiple")
	if err != nil || multiple != "true" {
		t.Fatalf("journal import input is not multiple: value %q, error %v", multiple, err)
	}
	if err := importInput.SendKeys(strings.Join([]string{
		file.Name(), secondFile.Name(), thirdFile.Name(), fourthFile.Name(),
	}, "\n")); err != nil {
		t.Fatalf("select multiple voice memos: %v", err)
	}
	recentUploads, err := driver.FindElements(selenium.ByXPATH, "//*[normalize-space()='Recent uploads']")
	if err != nil {
		t.Fatalf("inspect default journal view: %v", err)
	}
	if len(recentUploads) != 0 {
		t.Fatalf("default journal view still contained recent uploads")
	}
	if err := waitForJournalSummaryCitations(driver, "Local journal journal", 4, 30*time.Second); err != nil {
		t.Fatalf("whole journal overview was not summarized after upload: %v", err)
	}
	for _, level := range []string{"Years", "Months", "Weeks", "Days"} {
		link, err := waitForElement(
			driver,
			selenium.ByXPATH,
			fmt.Sprintf("//a[@aria-label='Zoom in to %s']", level),
			10*time.Second,
		)
		if err != nil {
			t.Fatalf("journal could not zoom in to %s: %v", level, err)
		}
		if err := link.Click(); err != nil {
			t.Fatalf("zoom journal in to %s: %v", level, err)
		}
		if _, err := waitForElement(driver, selenium.ByXPATH, fmt.Sprintf("//h2[normalize-space()='%s']", level), 10*time.Second); err != nil {
			t.Fatalf("journal did not show %s after zooming: %v", level, err)
		}
	}
	if err := waitForText(driver, "Local day journal", 10*time.Second); err != nil {
		t.Fatalf("multi-entry day summary did not appear immediately: %v", err)
	}
	if err := driver.Get(journalURL.String()); err != nil {
		t.Fatalf("return to journal before checking scheduled refresh: %v", err)
	}
	zoomToYears, err := waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Years']", 30*time.Second)
	if err != nil {
		t.Fatalf("journal overview could not zoom to years: %v", err)
	}
	if err := zoomToYears.Click(); err != nil {
		t.Fatalf("zoom journal overview to years: %v", err)
	}
	yearLink, err := waitForElement(driver, selenium.ByCSSSelector, "a[data-journal-period-link='year']", 30*time.Second)
	if err != nil {
		t.Fatalf("journal year disappeared: %v", err)
	}
	yearLinkText, err := yearLink.Text()
	if err != nil {
		t.Fatalf("read unfinished journal year link: %v", err)
	}
	if len(yearLinkText) != 4 || strings.Trim(yearLinkText, "0123456789") != "" {
		t.Fatalf("journal year link label = %q, want a bare four-digit year", yearLinkText)
	}
	usesSiteLinkColour, err := driver.ExecuteScript(`
		const link = document.querySelector("a[data-journal-period-link='year']");
		return link !== null &&
			getComputedStyle(link).color === getComputedStyle(link.parentElement).color;
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal year link colour: %v", err)
	}
	if usesSiteLinkColour != true {
		t.Fatalf("journal year does not use the normal site link colour")
	}
	apiBase, err := apiRoot()
	if err != nil {
		t.Fatalf("journal API root: %v", err)
	}
	apiBase.Path = "/__local/journal/refresh"
	query := apiBase.Query()
	query.Set("at", time.Now().UTC().Format(time.RFC3339))
	apiBase.RawQuery = query.Encode()
	if err := waitForScheduledJournalSummaries(driver, apiBase.String(), 4, 30*time.Second); err != nil {
		t.Fatalf("immediate journal summaries did not survive scheduled refresh: %v", err)
	}
	monthLink, err := waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Months']", 10*time.Second)
	if err != nil {
		t.Fatalf("journal year did not link to its months: %v", err)
	}
	if err := monthLink.Click(); err != nil {
		t.Fatalf("open journal months: %v", err)
	}
	if err := waitForText(driver, "Local month journal", 10*time.Second); err != nil {
		t.Fatalf("journal month route: %v", err)
	}
	weekLink, err := waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Weeks']", 10*time.Second)
	if err != nil {
		t.Fatalf("journal month did not link to its weeks: %v", err)
	}
	if err := weekLink.Click(); err != nil {
		t.Fatalf("open journal weeks: %v", err)
	}
	if err := waitForText(driver, "Local week journal", 10*time.Second); err != nil {
		t.Fatalf("journal week route: %v", err)
	}
	dayListLink, err := waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Days']", 10*time.Second)
	if err != nil {
		t.Fatalf("journal week did not link to its days: %v", err)
	}
	if err := dayListLink.Click(); err != nil {
		t.Fatalf("open journal days: %v", err)
	}
	if _, err := waitForElement(driver, selenium.ByXPATH, "//h2[normalize-space()='Days']", 10*time.Second); err != nil {
		t.Fatalf("journal day timeline heading: %v", err)
	}
	if err := waitForText(driver, "Local day journal", 10*time.Second); err != nil {
		t.Fatalf("journal day list route: %v", err)
	}
	if err := waitForJournalAudioCount(driver, 4, 10*time.Second); err != nil {
		t.Fatalf("journal day timeline did not contain its entries: %v", err)
	}
	usesTimeOnlyEntryHeadings, err := driver.ExecuteScript(`
		const times = [...document.querySelectorAll(
			"details[id^='entry-'] > summary > time"
		)];
		return times.length === 4 && times.every(time =>
			time.lang === 'en-GB' &&
			time.textContent === '19:16'
		);
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal entry times: %v", err)
	}
	if usesTimeOnlyEntryHeadings != true {
		t.Fatalf("journal entry headings repeated their parent day")
	}
	entrySummaryDates, err := driver.ExecuteScript(`
		const day = document.querySelector(
			'[data-journal-period-start^="2025-08-13"]'
		);
		const entries = [...(day?.querySelectorAll("details[id^='entry-']") ?? [])];
		const dates = entries.map(entry => {
			const entryDate = entry.querySelector(':scope > summary > time');
			const summaryDate = entry.querySelector(
				":scope > article header > p > time"
			);
			return {
				entryDateTime: entryDate?.dateTime ?? null,
				entryText: entryDate?.textContent ?? null,
				summaryDateTime: summaryDate?.dateTime ?? null,
				summaryText: summaryDate?.textContent ?? null,
			};
		});
		return {
			dates,
			valid: entries.length === 2 && entries.every(entry => {
				const entryDate = entry.querySelector(':scope > summary > time');
				const summaryDate = entry.querySelector(
					":scope > article header > p > time"
				);
				return entryDate !== null &&
					summaryDate !== null &&
					entryDate.dateTime.slice(0, 10) === '2025-08-13' &&
					summaryDate.dateTime.slice(0, 10) === '2025-08-13' &&
					entryDate.textContent === '19:16' &&
					summaryDate.textContent.includes('the 13th of August 2025');
			}),
		};
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal entry summary dates: %v", err)
	}
	if entrySummaryDates.(map[string]interface{})["valid"] != true {
		t.Fatalf("journal entry and summary dates did not use the recording time zone: %#v", entrySummaryDates)
	}
	transcriptsScrollable, err := driver.ExecuteScript(`
		const transcripts = [...document.querySelectorAll('[data-journal-transcript]')];
		return transcripts.length === 4 && transcripts.every(transcript =>
			transcript.tagName === 'DIV' &&
			transcript.getAttribute('role') === 'region' &&
			getComputedStyle(transcript).overflowY === 'auto'
		);
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal transcripts: %v", err)
	}
	if transcriptsScrollable != true {
		t.Fatalf("journal transcripts were not rendered as scrollable regions")
	}
	for _, level := range []string{"Weeks", "Months", "Years", "Overview"} {
		back, err := waitForElement(driver, selenium.ByXPATH, fmt.Sprintf("//a[@aria-label='Zoom out to %s']", level), 10*time.Second)
		if err != nil {
			t.Fatalf("journal could not zoom out to %s: %v", level, err)
		}
		if err := back.Click(); err != nil {
			t.Fatalf("zoom journal out to %s: %v", level, err)
		}
	}
	if err := waitForText(driver, "Local journal journal", 10*time.Second); err != nil {
		t.Fatalf("journal hierarchy did not return to its overview: %v", err)
	}
	markdown, err := waitForElement(driver, selenium.ByCSSSelector, "[data-journal-summary-block] strong", 10*time.Second)
	if err != nil {
		t.Fatalf("render journal summary markdown: %v", err)
	}
	markdownText, err := markdown.Text()
	if err != nil {
		t.Fatalf("read rendered journal summary markdown: %v", err)
	}
	if markdownText != "rendered Markdown" {
		t.Fatalf("journal summary Markdown emphasis was not rendered: got %q", markdownText)
	}

	citations, err := driver.FindElements(selenium.ByCSSSelector, "sup > a[aria-label^='Play source at '][href]")
	if err != nil || len(citations) == 0 {
		t.Fatalf("summary citations: found %d, error %v", len(citations), err)
	}
	firstCitationText, err := citations[0].Text()
	if err != nil {
		t.Fatalf("read first timestamp citation: %v", err)
	}
	if firstCitationText != "[1]" {
		t.Fatalf("first citation label = %q, want numbered reference [1]", firstCitationText)
	}
	var firstCitation selenium.WebElement
	var firstEntryID string
	for _, citation := range citations {
		entryID, err := citation.GetAttribute("data-citation-entry-id")
		if err != nil {
			t.Fatalf("read citation target: %v", err)
		}
		href, err := citation.GetAttribute("href")
		if err != nil {
			t.Fatalf("read citation href: %v", err)
		}
		if firstCitation == nil && entryID != "" && strings.Contains(href, "2025-08-13") {
			firstCitation, firstEntryID = citation, entryID
		}
	}
	if firstCitation == nil {
		t.Fatalf("year summary did not cite the multi-entry journal day")
	}
	firstCitationHref, err := firstCitation.GetAttribute("href")
	if err != nil || !strings.Contains(firstCitationHref, "/journal/day?") || !strings.Contains(firstCitationHref, "at=") {
		t.Fatalf("aggregate citation did not link to an individual day: href %q, error %v", firstCitationHref, err)
	}
	if _, err := driver.ExecuteScript(`
		arguments[0].dispatchEvent(new PointerEvent('pointerover', {
			bubbles: true,
			pointerType: 'mouse',
		}));
	`, []any{firstCitation}); err != nil {
		t.Fatalf("hover summary citation: %v", err)
	}
	citationTooltip, err := waitForElement(driver, selenium.ByCSSSelector, "[role='tooltip']", 10*time.Second)
	if err != nil {
		t.Fatalf("citation tooltip: %v", err)
	}
	citationTooltipText, err := citationTooltip.Text()
	if err != nil {
		t.Fatalf("read citation tooltip: %v", err)
	}
	if !strings.Contains(citationTooltipText, "Local entry journal") || !strings.Contains(citationTooltipText, "“Local development transcript") || !strings.Contains(citationTooltipText, "00:00:00") || strings.Contains(citationTooltipText, "00:00:00.0") {
		t.Fatalf("citation tooltip did not show its reference: %q", citationTooltipText)
	}
	visibleReferenceBox, err := driver.FindElements(selenium.ByXPATH, "//footer[.//h4[normalize-space()='References']]")
	if err != nil {
		t.Fatalf("inspect journal reference box: %v", err)
	}
	if len(visibleReferenceBox) != 0 {
		t.Fatalf("journal summary still rendered a separate References box")
	}
	if err := firstCitation.Click(); err != nil {
		t.Fatalf("play first summary citation: %v", err)
	}
	if err := waitForExclusiveJournalAudioPlayback(driver, firstEntryID, 10*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("first cited journal audio did not play exclusively: %v", err)
	}
	delayedAudioSource, err := driver.ExecuteScript(`
		const audio = [...document.querySelectorAll('audio[data-entry-id]')]
			.find(value => value.dataset.entryId === arguments[0]);
		return audio?.currentSrc ?? '';
	`, []any{firstEntryID})
	if err != nil {
		t.Fatalf("inspect delayed journal audio source: %v", err)
	}
	if source, _ := delayedAudioSource.(string); !strings.Contains(source, "delayMs=1500") {
		t.Fatalf("journal integration audio was not delayed: %q", source)
	}
	if err := waitForJournalAudioAdvance(driver, firstEntryID, 2750*time.Millisecond, 8*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("delayed journal audio did not advance continuously while updating its URL: %v", err)
	}
	if err := waitForCurrentlySpokenTranscript(driver, firstEntryID, 10*time.Second); err != nil {
		t.Fatalf("first playing transcript was not highlighted: %v", err)
	}
	if err := waitForCenteredJournalTranscript(driver, firstEntryID, 10*time.Second); err != nil {
		t.Fatalf("currently spoken journal transcript segment was not centered: %v", err)
	}
	stickyNavigationAndAudio, err := driver.ExecuteScript(`
		const audio = [...document.querySelectorAll('audio[data-entry-id]')]
			.find(value => value.dataset.entryId === arguments[0]);
		const dock = audio?.closest('[data-journal-audio-dock]');
		const navigation = document.querySelector("nav[aria-label='Journal zoom']");
		if (!dock || !navigation) return false;
		const dockStyle = getComputedStyle(dock);
		const navigationStyle = getComputedStyle(navigation);
		const initialScroll = scrollY;
		const navigationDocumentTop =
			navigation.getBoundingClientRect().top + scrollY;
		window.scrollTo(0, navigationDocumentTop + 100);
		const navigationPinned = Math.abs(
			navigation.getBoundingClientRect().top
		) < 0.5;
		window.scrollTo(0, initialScroll);
		return navigationPinned &&
			navigationStyle.position === 'sticky' &&
			navigationStyle.top === '0px' &&
			dockStyle.position === 'sticky' &&
			Math.abs(
				Number.parseFloat(dockStyle.top) -
				navigation.getBoundingClientRect().height
			) < 0.5 &&
			Number(navigationStyle.zIndex) > Number(dockStyle.zIndex);
	`, []any{firstEntryID})
	if err != nil {
		t.Fatalf("inspect sticky journal navigation and audio: %v", err)
	}
	if stickyNavigationAndAudio != true {
		t.Fatalf("journal navigation and audio did not remain stacked while reading")
	}
	if err := waitForText(driver, "Local development transcript", 10*time.Second); err != nil {
		t.Fatalf("linked transcript: %v", err)
	}
	transcripts, err := driver.FindElements(selenium.ByCSSSelector, "[data-journal-transcript]")
	if err != nil || len(transcripts) != 4 {
		t.Fatalf("day timeline transcripts: found %d, error %v", len(transcripts), err)
	}
	paragraphTranscripts, err := driver.ExecuteScript(`
		const transcripts = [...document.querySelectorAll(
			'[data-journal-transcript]'
		)];
		return transcripts.length === 4 && transcripts.every(transcript => {
			const text = transcript.querySelector('[data-journal-transcript-text]');
			const paragraphs = text?.querySelectorAll(':scope > p');
			return text !== null &&
				text.querySelector('ol, li') === null &&
				paragraphs?.length === 2 &&
				[...paragraphs].every(paragraph => {
					const timestamp = paragraph.querySelector(
						':scope > a[data-journal-transcript-paragraph]'
					);
					const firstSegment = paragraph.querySelector(
						':scope > span a[data-journal-transcript-segment]'
					);
					return paragraph.querySelectorAll(':scope > span').length > 0 &&
						/^\d{2}:\d{2}:\d{2}$/.test(timestamp?.textContent ?? '') &&
						timestamp?.getAttribute('href') ===
							firstSegment?.getAttribute('href');
				});
		});
	`, nil)
	if err != nil {
		t.Fatalf("inspect paragraph-separated journal transcripts: %v", err)
	}
	if paragraphTranscripts != true {
		t.Fatalf("journal transcripts did not separate segments after a three-second pause")
	}
	var secondEntryID string
	dayCitations, err := driver.FindElements(selenium.ByCSSSelector, "sup > a[aria-label^='Play source at '][href]")
	if err != nil {
		t.Fatalf("individual day citations: %v", err)
	}
	for _, citation := range dayCitations {
		entryID, err := citation.GetAttribute("data-citation-entry-id")
		if err != nil {
			t.Fatalf("read individual day citation target: %v", err)
		}
		if entryID != "" && entryID != firstEntryID {
			secondEntryID = entryID
			break
		}
	}
	if secondEntryID == "" {
		t.Fatalf("individual day citations did not address the second journal entry")
	}
	secondTranscript, err := driver.FindElement(selenium.ByCSSSelector, fmt.Sprintf("[data-journal-transcript='%s']", secondEntryID))
	if err != nil {
		t.Fatalf("find second journal transcript: %v", err)
	}
	secondEntrySummary, err := driver.FindElement(selenium.ByCSSSelector, fmt.Sprintf("details[id='entry-%s'] > summary", secondEntryID))
	if err != nil {
		t.Fatalf("find second journal entry disclosure: %v", err)
	}
	if err := secondEntrySummary.Click(); err != nil {
		t.Fatalf("open second journal entry: %v", err)
	}
	secondTranscriptSegment, err := secondTranscript.FindElement(selenium.ByCSSSelector, "a[data-journal-transcript-segment]")
	if err != nil {
		t.Fatalf("find second journal transcript segment: %v", err)
	}
	if err := secondTranscriptSegment.Click(); err != nil {
		t.Fatalf("play second journal transcript segment: %v", err)
	}
	if err := waitForExclusiveJournalAudioPlayback(driver, secondEntryID, 10*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("tapping transcript text did not play its audio exclusively: %v", err)
	}
	if err := waitForCurrentlySpokenTranscript(driver, secondEntryID, 10*time.Second); err != nil {
		t.Fatalf("second playing transcript was not highlighted: %v", err)
	}
	if err := driver.Back(); err != nil {
		t.Fatalf("navigate back to first cited journal audio: %v", err)
	}
	if err := waitForExclusiveJournalAudioPlayback(driver, firstEntryID, 10*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("Back did not restore the first cited journal audio: %v", err)
	}
	if _, err := driver.ExecuteScript(`
		const audio = [...document.querySelectorAll('audio[data-entry-id]')]
			.find(value => value.dataset.entryId === arguments[0]);
		audio?.pause();
	`, []any{firstEntryID}); err != nil {
		t.Fatalf("pause restored journal audio: %v", err)
	}
	if err := journalAudioRemainsPaused(driver, firstEntryID, time.Second); err != nil {
		t.Fatalf("paused journal audio restarted from URL state: %v", err)
	}
	if err := waitForNoElement(driver, selenium.ByCSSSelector, "[data-journal-currently-spoken]", 10*time.Second); err != nil {
		t.Fatalf("paused journal transcript remained highlighted: %v", err)
	}
	deleteThumb, err := waitForElement(
		driver,
		selenium.ByCSSSelector,
		fmt.Sprintf("button[data-journal-delete-thumb='%s'][role='slider']", firstEntryID),
		10*time.Second,
	)
	if err != nil {
		t.Fatalf("completed journal entry did not have a swipe-to-delete control: %v", err)
	}
	if err := deleteThumb.Click(); err != nil {
		t.Fatalf("click swipe-to-delete thumb: %v", err)
	}
	if err := journalAudioCountRemains(driver, 4, time.Second); err != nil {
		t.Fatalf("ordinary click deleted a journal entry: %v", err)
	}
	if _, err := driver.ExecuteScript(`
		const thumb = arguments[0];
		const track = thumb.closest('[data-journal-delete-track]');
		const bounds = track.getBoundingClientRect();
		const options = {
			bubbles: true,
			cancelable: true,
			clientX: bounds.left + 22,
			isPrimary: true,
			pointerId: 42,
			pointerType: 'touch',
		};
		thumb.dispatchEvent(new PointerEvent('pointerdown', options));
		options.clientX = bounds.right - 2;
		thumb.dispatchEvent(new PointerEvent('pointermove', options));
		thumb.dispatchEvent(new PointerEvent('pointerup', options));
	`, []any{deleteThumb}); err != nil {
		t.Fatalf("swipe journal delete control: %v", err)
	}
	if err := waitForNoElement(driver, selenium.ByID, "entry-"+firstEntryID, 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("swiped journal entry was not deleted: %v", err)
	}
	if err := waitForJournalAudioCount(driver, 3, 10*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("journal did not remove exactly one swiped entry: %v", err)
	}
	playbackQueryCleared, err := driver.ExecuteScript(`
		return !new URL(location.href).searchParams.has('entry') &&
			!new URL(location.href).searchParams.has('t');
	`, nil)
	if err != nil {
		t.Fatalf("inspect journal URL after deleting selected entry: %v", err)
	}
	if playbackQueryCleared != true {
		t.Fatalf("deleting the selected journal entry left its playback URL active")
	}
	journalAudio, err := driver.FindElements(selenium.ByCSSSelector, "audio[data-entry-id]")
	if err != nil {
		t.Fatalf("count journal entries before recording: %v", err)
	}
	baselineAudioCount := len(journalAudio)

	recordButton, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Record a note']", 10*time.Second)
	if err != nil {
		t.Fatalf("record button: %v", err)
	}
	if err := recordButton.Click(); err != nil {
		t.Fatalf("start recording: %v", err)
	}
	if err := waitForJournalWaveform(driver, 10*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("live recording waveform: %v", err)
	}
	if _, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Submit note']", 10*time.Second); err != nil {
		t.Fatalf("submit recording button: %v", err)
	}
	cancelButton, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Cancel recording']", 10*time.Second)
	if err != nil {
		t.Fatalf("cancel recording button: %v", err)
	}
	if err := cancelButton.Click(); err != nil {
		t.Fatalf("cancel recording: %v", err)
	}
	if err := waitForNoElement(driver, selenium.ByCSSSelector, "canvas[aria-label='Live recording waveform']", 10*time.Second); err != nil {
		t.Fatalf("waveform remained after recording stopped: %v", err)
	}
	if err := journalAudioCountRemains(driver, baselineAudioCount, 2*time.Second); err != nil {
		t.Fatalf("cancelled recording was submitted: %v", err)
	}

	recordButton, err = waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Record a note']", 10*time.Second)
	if err != nil {
		t.Fatalf("record button after cancellation: %v", err)
	}
	if err := recordButton.Click(); err != nil {
		t.Fatalf("start submitted recording: %v", err)
	}
	if err := waitForJournalWaveform(driver, 10*time.Second); err != nil {
		t.Fatalf("submitted recording waveform: %v", err)
	}
	submitButton, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Submit note']", 10*time.Second)
	if err != nil {
		t.Fatalf("submit recording button: %v", err)
	}
	if err := submitButton.Click(); err != nil {
		t.Fatalf("submit recording: %v", err)
	}
	if _, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "button[aria-label='Record a note']", 30*time.Second); err != nil {
		t.Fatalf("submitted recording upload did not finish: %v", err)
	}
	if err := driver.Get(journalURL.String()); err != nil {
		t.Fatalf("open journal after submitted recording: %v", err)
	}
	zoomToYears, err = waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Years']", 30*time.Second)
	if err != nil {
		t.Fatalf("submitted recording overview could not zoom to years: %v", err)
	}
	if err := zoomToYears.Click(); err != nil {
		t.Fatalf("zoom submitted recording overview to years: %v", err)
	}
	currentYearLink, err := waitForElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//a[@data-journal-period-link='year'][contains(normalize-space(), '%d')]", time.Now().Year()),
		30*time.Second,
	)
	if err != nil {
		t.Fatalf("submitted recording year was not displayed: %v", err)
	}
	if err := currentYearLink.Click(); err != nil {
		t.Fatalf("open submitted recording year: %v", err)
	}
	for _, period := range []string{"month", "week"} {
		link, err := waitForElement(
			driver,
			selenium.ByCSSSelector,
			fmt.Sprintf("a[data-journal-period-link='%s']", period),
			30*time.Second,
		)
		if err != nil {
			t.Fatalf("submitted recording %s was not displayed: %v", period, err)
		}
		if period == "week" {
			label, err := link.Text()
			if err != nil {
				t.Fatalf("read submitted recording week label: %v", err)
			}
			if !strings.HasPrefix(strings.TrimSpace(label), "Week starting ") {
				t.Fatalf("submitted recording week label = %q", label)
			}
		}
		if err := link.Click(); err != nil {
			t.Fatalf("open submitted recording %s: %v", period, err)
		}
	}
	if err := waitForJournalAudioCount(driver, 4, 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("submitted recording did not become a journal entry: %v", err)
	}
	currentDayAudio := append([]byte(nil), audio...)
	currentDayAudio[len(currentDayAudio)-4] = 1
	currentDayFile, err := os.CreateTemp(t.TempDir(), "journal-current-day-*.wav")
	if err != nil {
		t.Fatalf("create second current-day voice memo: %v", err)
	}
	if _, err := currentDayFile.Write(currentDayAudio); err != nil {
		t.Fatalf("write second current-day voice memo: %v", err)
	}
	if err := currentDayFile.Close(); err != nil {
		t.Fatalf("close second current-day voice memo: %v", err)
	}
	currentDayImport, err := waitForElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 10*time.Second)
	if err != nil {
		t.Fatalf("find current-day journal import input: %v", err)
	}
	if err := currentDayImport.SendKeys(currentDayFile.Name()); err != nil {
		t.Fatalf("import second current-day voice memo: %v", err)
	}
	if err := waitForJournalAudioCount(driver, 5, 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("second current-day voice memo did not become a journal entry: %v", err)
	}
	if err := waitForText(driver, "Local day journal", 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("in-progress day summary was not displayed after its second entry: %v", err)
	}
	currentDayURL, err := driver.CurrentURL()
	if err != nil {
		t.Fatalf("read current journal day URL: %v", err)
	}
	currentMonthAudio := append([]byte(nil), audio...)
	currentMonthAudio[len(currentMonthAudio)-4] = 2
	currentMonthFile, err := os.CreateTemp(t.TempDir(), "journal-current-month-*.wav")
	if err != nil {
		t.Fatalf("create current-month voice memo: %v", err)
	}
	if _, err := currentMonthFile.Write(currentMonthAudio); err != nil {
		t.Fatalf("write current-month voice memo: %v", err)
	}
	if err := currentMonthFile.Close(); err != nil {
		t.Fatalf("close current-month voice memo: %v", err)
	}
	journalLocation, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatalf("load journal time zone: %v", err)
	}
	localNow := time.Now().In(journalLocation)
	otherDay := 1
	if localNow.Day() == otherDay {
		otherDay = 2
	}
	otherCurrentMonthTime := time.Date(
		localNow.Year(), localNow.Month(), otherDay, 12, 0, 0, 0, journalLocation,
	)
	if err := os.Chtimes(currentMonthFile.Name(), otherCurrentMonthTime, otherCurrentMonthTime); err != nil {
		t.Fatalf("date voice memo on another day in the current month: %v", err)
	}
	currentMonthImport, err := waitForElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 10*time.Second)
	if err != nil {
		t.Fatalf("find current-month journal import input: %v", err)
	}
	if err := currentMonthImport.SendKeys(currentMonthFile.Name()); err != nil {
		t.Fatalf("import voice memo on another current-month day: %v", err)
	}
	if _, err := waitForEnabledElement(driver, selenium.ByCSSSelector, "input[aria-label='Import voice memo']", 30*time.Second); err != nil {
		t.Fatalf("current-month journal upload did not finish: %v", err)
	}
	if err := driver.Get(journalURL.String()); err != nil {
		t.Fatalf("return to journal before checking current-month summary: %v", err)
	}
	zoomToYears, err = waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Years']", 30*time.Second)
	if err != nil {
		t.Fatalf("current journal overview could not zoom to years: %v", err)
	}
	if err := zoomToYears.Click(); err != nil {
		t.Fatalf("zoom current journal overview to years: %v", err)
	}
	currentYearLink, err = waitForElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//a[@data-journal-period-link='year'][contains(normalize-space(), '%d')]", localNow.Year()),
		30*time.Second,
	)
	if err != nil {
		t.Fatalf("current journal year was not displayed: %v", err)
	}
	if err := currentYearLink.Click(); err != nil {
		t.Fatalf("open current journal year: %v", err)
	}
	if err := waitForText(driver, "Local month journal", 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("generated current-month summary was not displayed: %v", err)
	}
	if err := driver.Get(currentDayURL); err != nil {
		t.Fatalf("return to current journal day: %v", err)
	}
	if err := waitForJournalAudioCount(driver, 6, 30*time.Second); err != nil {
		t.Fatalf("journal timeline did not retain all six entries: %v", err)
	}
	currentDayStart := time.Date(
		localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, journalLocation,
	).UTC().Format("2006-01-02T15:04:05Z")
	currentEntries, err := driver.FindElements(
		selenium.ByCSSSelector,
		fmt.Sprintf("[data-journal-period-start='%s'] details:has(audio)", currentDayStart),
	)
	if err != nil || len(currentEntries) != 2 {
		t.Fatalf("find current-day journal entries: count %d, error %v", len(currentEntries), err)
	}
	entrySummary, err := currentEntries[0].FindElement(selenium.ByCSSSelector, "summary")
	if err != nil {
		t.Fatalf("find journal entry disclosure: %v", err)
	}
	if err := entrySummary.Click(); err != nil {
		t.Fatalf("open journal entry date editor: %v", err)
	}
	dateInput, err := currentEntries[0].FindElement(selenium.ByCSSSelector, "input[type='date']")
	if err != nil {
		t.Fatalf("find journal recording date input: %v", err)
	}
	currentDateValue, err := dateInput.GetAttribute("value")
	if err != nil {
		t.Fatalf("read journal recording date: %v", err)
	}
	currentDate, err := time.Parse(time.DateOnly, currentDateValue)
	if err != nil {
		t.Fatalf("parse journal recording date %q: %v", currentDateValue, err)
	}
	targetDate := currentDate.AddDate(0, 0, 1)
	if err := dateInput.Clear(); err != nil {
		t.Fatalf("clear journal recording date: %v", err)
	}
	if err := dateInput.SendKeys(targetDate.Format("01/02/2006")); err != nil {
		t.Fatalf("enter corrected journal recording date: %v", err)
	}
	saveDate, err := waitForEnabledElement(
		driver,
		selenium.ByXPATH,
		"//form[@aria-label='Edit recording date']//button[normalize-space()='Save date' and not(@disabled)]",
		10*time.Second,
	)
	if err != nil {
		t.Fatalf("corrected journal recording date was not editable: %v", err)
	}
	if err := saveDate.Click(); err != nil {
		t.Fatalf("save corrected journal recording date: %v", err)
	}
	if err := waitForJournalPeriodAudioCount(driver, currentDayStart, 1, 30*time.Second); err != nil {
		dumpPageDiagnostics(t, driver)
		t.Fatalf("corrected entry did not leave its original day: %v", err)
	}
	if err := waitForNoElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//*[@data-journal-period-start='%s']//*[normalize-space()='Local day journal']", currentDayStart),
		30*time.Second,
	); err != nil {
		t.Fatalf("original singleton day retained its aggregate summary: %v", err)
	}
	if err := driver.Get(journalURL.String()); err != nil {
		t.Fatalf("return to journal after changing recording date: %v", err)
	}
	zoomToYears, err = waitForElement(driver, selenium.ByXPATH, "//a[@aria-label='Zoom in to Years']", 30*time.Second)
	if err != nil {
		t.Fatalf("corrected journal overview could not zoom to years: %v", err)
	}
	if err := zoomToYears.Click(); err != nil {
		t.Fatalf("zoom corrected journal overview to years: %v", err)
	}
	targetYear, err := waitForElement(
		driver,
		selenium.ByXPATH,
		fmt.Sprintf("//a[@data-journal-period-link='year'][contains(normalize-space(), '%d')]", targetDate.Year()),
		30*time.Second,
	)
	if err != nil {
		t.Fatalf("corrected journal year was not displayed: %v", err)
	}
	if err := targetYear.Click(); err != nil {
		t.Fatalf("open corrected journal year: %v", err)
	}
	for _, period := range []string{"month", "week"} {
		link, err := waitForElement(
			driver,
			selenium.ByCSSSelector,
			fmt.Sprintf("a[data-journal-period-link='%s']", period),
			30*time.Second,
		)
		if err != nil {
			t.Fatalf("corrected journal %s was not displayed: %v", period, err)
		}
		if err := link.Click(); err != nil {
			t.Fatalf("open corrected journal %s: %v", period, err)
		}
	}
	correctedInput, err := waitForElement(driver, selenium.ByCSSSelector, "input[type='date']", 30*time.Second)
	if err != nil {
		t.Fatalf("find corrected journal entry date: %v", err)
	}
	correctedDate, err := correctedInput.GetAttribute("value")
	if err != nil {
		t.Fatalf("read corrected journal entry date: %v", err)
	}
	if correctedDate != targetDate.Format(time.DateOnly) {
		t.Fatalf("corrected journal entry date = %q, want %q", correctedDate, targetDate.Format(time.DateOnly))
	}
}

func journalDynamoDBClient() (*dynamodb.Client, error) {
	root, err := dynamoDBRoot()
	if err != nil {
		return nil, err
	}
	return dynamodb.New(dynamodb.Options{
		EndpointResolver: dynamodb.EndpointResolverFromURL(root.String()),
		Retryer:          aws.NopRetryer{},
		Credentials: credentials.StaticCredentialsProvider{Value: aws.Credentials{
			AccessKeyID: "LOCALSTACK", SecretAccessKey: "LOCALSTACK",
		}},
	}), nil
}

func putProcessingJournalEntry(ctx context.Context, entryID string) error {
	return putJournalEntry(ctx, entryID, apiserver.JournalEntryStatusProcessing)
}

func putJournalEntry(ctx context.Context, entryID string, status apiserver.JournalEntryStatus) error {
	client, err := journalDynamoDBClient()
	if err != nil {
		return err
	}
	item, err := attributevalue.MarshalMap(apiserver.JournalStoredRecord{
		Id:   "thomas",
		When: "ENTRY#" + entryID,
		Kind: apiserver.JournalStoredRecordKindEntry,
		Entry: &apiserver.JournalStoredEntry{
			SchemaVersion: 1,
			Id:            entryID,
			RecordedAt:    time.Now().UTC(),
			TimeZone:      "America/Los_Angeles",
			ContentType:   "audio/wav",
			AudioKey:      "entries/" + entryID + "/source",
			Status:        status,
			Transcript:    []apiserver.JournalTranscriptSegment{},
		},
	})
	if err != nil {
		return err
	}
	_, err = client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String("table6"),
		Item:      item,
	})
	return err
}

func deleteJournalEntry(ctx context.Context, entryID string) error {
	client, err := journalDynamoDBClient()
	if err != nil {
		return err
	}
	_, err = client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String("table6"),
		Key: map[string]types.AttributeValue{
			"id":   &types.AttributeValueMemberS{Value: "thomas"},
			"when": &types.AttributeValueMemberS{Value: "ENTRY#" + entryID},
		},
	})
	return err
}

func dispatchJournalFile(driver selenium.WebDriver, path, eventType string) error {
	const stagingInputID = "journal-transfer-test-file"
	if _, err := driver.ExecuteScript(`
		const previous = document.getElementById(arguments[0]);
		previous?.remove();
		const input = document.createElement('input');
		input.id = arguments[0];
		input.type = 'file';
		input.hidden = true;
		document.body.append(input);
	`, []any{stagingInputID}); err != nil {
		return fmt.Errorf("create transfer file input: %w", err)
	}
	input, err := driver.FindElement(selenium.ByID, stagingInputID)
	if err != nil {
		return fmt.Errorf("find transfer file input: %w", err)
	}
	if err := input.SendKeys(path); err != nil {
		return fmt.Errorf("load transfer file: %w", err)
	}
	if err := driver.SetAsyncScriptTimeout(30 * time.Second); err != nil {
		return fmt.Errorf("set %s upload timeout: %w", eventType, err)
	}
	value, err := driver.ExecuteScriptAsync(`
		const input = document.getElementById(arguments[0]);
		const eventType = arguments[1];
		const done = arguments[2];
		const uploadInput = document.querySelector(
			'input[type=file]:not(#' + CSS.escape(arguments[0]) + ')'
		);
		if (!input || !uploadInput) {
			done('could not find the staged file or journal upload input');
			return;
		}
		let sawPending = uploadInput.disabled;
		let settled = false;
		const finish = error => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			clearTimeout(timer);
			input.remove();
			done(error ?? null);
		};
		const observer = new MutationObserver(() => {
			if (uploadInput.disabled) sawPending = true;
			else if (sawPending) finish();
		});
		observer.observe(uploadInput, {
			attributes: true,
			attributeFilter: ['disabled'],
		});
		const timer = setTimeout(
			() => finish('upload did not settle (pending observed: ' + sawPending + ')'),
			25_000
		);
		const transfer = new DataTransfer();
		if (eventType === 'drop') {
			for (const type of ['dragenter', 'dragover']) {
				const accepted = !document.dispatchEvent(new DragEvent(type, {
					bubbles: true,
					cancelable: true,
					dataTransfer: transfer,
				}));
				if (!accepted) {
					finish(type + ' was not accepted before Chrome materialized the file');
					return;
				}
			}
			for (const file of input.files) transfer.items.add(file);
			document.dispatchEvent(new DragEvent('drop', {
				bubbles: true,
				cancelable: true,
				dataTransfer: transfer,
			}));
		} else {
			for (const file of input.files) transfer.items.add(file);
			const event = new Event('paste', { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'clipboardData', { value: transfer });
			document.dispatchEvent(event);
		}
	`, []any{stagingInputID, eventType})
	if err != nil {
		return fmt.Errorf("dispatch %s event: %w", eventType, err)
	}
	if message, ok := value.(string); ok && message != "" {
		return fmt.Errorf("dispatch %s event: %s", eventType, message)
	}
	return nil
}

func waitForScheduledJournalSummaries(driver selenium.WebDriver, refreshURL string, wantEntries int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	lastYearSummaryCount := 0
	lastEntryIDs := map[string]struct{}{}
	for time.Now().Before(deadline) {
		request, err := http.NewRequest(http.MethodPost, refreshURL, nil)
		if err != nil {
			return err
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			return err
		}
		if err := response.Body.Close(); err != nil {
			return err
		}
		if response.StatusCode != http.StatusNoContent {
			return fmt.Errorf("scheduled journal refresh returned %s", response.Status)
		}
		if err := driver.Refresh(); err != nil {
			return err
		}
		pageDeadline := time.Now().Add(2 * time.Second)
		if pageDeadline.After(deadline) {
			pageDeadline = deadline
		}
		for time.Now().Before(pageDeadline) {
			yearSummaries, err := driver.FindElements(selenium.ByXPATH, "//h3[normalize-space()='Local year journal']")
			if err != nil {
				return err
			}
			lastYearSummaryCount = len(yearSummaries)
			citations, err := driver.FindElements(selenium.ByCSSSelector, "[data-citation-entry-id]")
			if err != nil {
				return err
			}
			entryIDs := map[string]struct{}{}
			for _, citation := range citations {
				entryID, err := citation.GetAttribute("data-citation-entry-id")
				if err != nil {
					return err
				}
				if entryID != "" {
					entryIDs[entryID] = struct{}{}
				}
			}
			lastEntryIDs = entryIDs
			if len(yearSummaries) > 0 && len(entryIDs) >= wantEntries {
				return nil
			}
			time.Sleep(100 * time.Millisecond)
		}
	}
	return fmt.Errorf(
		"timed out waiting for a year summary citing %d entries; saw %d year summaries citing %d distinct entries",
		wantEntries,
		lastYearSummaryCount,
		len(lastEntryIDs),
	)
}

func waitForJournalSummaryCitations(driver selenium.WebDriver, title string, wantEntries int, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		value, err := webDriver.ExecuteScript(`
			const title = arguments[0];
			const summary = [...document.querySelectorAll('article')].find(article =>
				article.querySelector('h3')?.textContent.trim() === title
			);
			if (!summary) return 0;
			return new Set(
				[...summary.querySelectorAll('[data-citation-entry-id]')]
					.map(citation => citation.getAttribute('data-citation-entry-id'))
					.filter(Boolean)
			).size;
		`, []any{title})
		if err != nil {
			return false, err
		}
		count, ok := value.(float64)
		return ok && int(count) >= wantEntries, nil
	}, timeout)
}

func testWAV() []byte {
	const (
		sampleRate     = 8000
		seconds        = 6
		bytesPerSample = 2
	)
	dataSize := sampleRate * seconds * bytesPerSample
	buffer := bytes.NewBuffer(make([]byte, 0, 44+dataSize))
	buffer.WriteString("RIFF")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(36+dataSize))
	buffer.WriteString("WAVEfmt ")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(16))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(1))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(buffer, binary.LittleEndian, uint32(sampleRate*bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(bytesPerSample))
	_ = binary.Write(buffer, binary.LittleEndian, uint16(8*bytesPerSample))
	buffer.WriteString("data")
	_ = binary.Write(buffer, binary.LittleEndian, uint32(dataSize))
	buffer.Write(make([]byte, dataSize))
	return buffer.Bytes()
}

func waitForExclusiveJournalAudioPlayback(driver selenium.WebDriver, entryID string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		value, err := webDriver.ExecuteScript(`
			const audios = [...document.querySelectorAll('audio[data-entry-id]')];
			const audio = audios.find(value => value.dataset.entryId === arguments[0]);
			if (!audio) return null;
			const playbackQuery = new URLSearchParams(window.location.search);
			const urlTime = playbackQuery.get('t');
			return {
				currentTime: audio.currentTime,
				ended: audio.ended,
				errorCode: audio.error?.code ?? 0,
				errorMessage: audio.error?.message ?? '',
				otherPlaying: audios.some(value => value !== audio && !value.paused),
				paused: audio.paused,
				readyState: audio.readyState,
				urlEntry: playbackQuery.get('entry') ?? '',
				urlTime: urlTime ?? '',
				urlTimeMatches: urlTime !== null && Math.abs(Number(urlTime) - audio.currentTime) <= 0.6,
			};
		`, []any{entryID})
		if err != nil {
			return false, err
		}
		state, ok := value.(map[string]interface{})
		if !ok {
			return false, nil
		}
		errorCode, _ := state["errorCode"].(float64)
		if errorCode != 0 {
			return false, fmt.Errorf(
				"media error %d: %v",
				int(errorCode),
				state["errorMessage"],
			)
		}
		readyState, _ := state["readyState"].(float64)
		paused, _ := state["paused"].(bool)
		ended, _ := state["ended"].(bool)
		otherPlaying, _ := state["otherPlaying"].(bool)
		currentTime, _ := state["currentTime"].(float64)
		urlEntry, _ := state["urlEntry"].(string)
		urlTime, _ := state["urlTime"].(string)
		urlTimeMatches, _ := state["urlTimeMatches"].(bool)
		return readyState >= 2 && !otherPlaying && urlEntry == entryID && urlTime != "" && urlTimeMatches && (ended || (!paused && currentTime > 0.05)), nil
	}, timeout)
}

func waitForJournalAudioAdvance(driver selenium.WebDriver, entryID string, advance, timeout time.Duration) error {
	if err := driver.SetAsyncScriptTimeout(timeout); err != nil {
		return err
	}
	value, err := driver.ExecuteScriptAsync(`
		const entryID = arguments[0];
		const advance = arguments[1];
		const timeout = arguments[2];
		const done = arguments[3];
		const audio = [...document.querySelectorAll('audio[data-entry-id]')]
			.find(value => value.dataset.entryId === entryID);
		if (!audio) {
			done(null);
			return;
		}
		let urlWrites = 0;
		const originalPushState = history.pushState;
		const originalReplaceState = history.replaceState;
		history.pushState = function(...arguments_) {
			urlWrites += 1;
			return originalPushState.apply(history, arguments_);
		};
		history.replaceState = function(...arguments_) {
			urlWrites += 1;
			return originalReplaceState.apply(history, arguments_);
		};
		const startedAt = audio.currentTime;
		let previous = startedAt;
		let largestRewind = 0;
		const started = performance.now();
		const interval = setInterval(() => {
			const current = audio.currentTime;
			largestRewind = Math.max(largestRewind, previous - current);
			previous = current;
			if (
				current >= startedAt + advance ||
				audio.paused ||
				performance.now() - started >= timeout - 100
			) {
				clearInterval(interval);
				history.pushState = originalPushState;
				history.replaceState = originalReplaceState;
				done({
					currentTime: current,
					largestRewind,
					paused: audio.paused,
					startedAt,
					urlWrites,
				});
			}
		}, 20);
	`, []any{entryID, advance.Seconds(), timeout.Milliseconds()})
	if err != nil {
		return err
	}
	state, ok := value.(map[string]interface{})
	if !ok {
		return fmt.Errorf("journal audio %q was not found", entryID)
	}
	startedAt, _ := state["startedAt"].(float64)
	currentTime, _ := state["currentTime"].(float64)
	largestRewind, _ := state["largestRewind"].(float64)
	paused, _ := state["paused"].(bool)
	urlWrites, _ := state["urlWrites"].(float64)
	want := startedAt + advance.Seconds()
	if paused || currentTime < want {
		return fmt.Errorf("audio advanced from %.3fs to %.3fs; wanted at least %.3fs without pausing", startedAt, currentTime, want)
	}
	if largestRewind > 0.075 {
		return fmt.Errorf("audio rewound by %.3fs while advancing from %.3fs to %.3fs", largestRewind, startedAt, currentTime)
	}
	if urlWrites > 2 {
		return fmt.Errorf("audio playback wrote the URL %.0f times while advancing for %.3fs", urlWrites, currentTime-startedAt)
	}
	return nil
}

func waitForCurrentlySpokenTranscript(driver selenium.WebDriver, entryID string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		value, err := webDriver.ExecuteScript(`
			const highlighted = [...document.querySelectorAll(
				'[data-journal-currently-spoken]'
			)];
			return highlighted.length === 1 &&
				highlighted[0].closest('details[id]')?.id === 'entry-' + arguments[0];
		`, []any{entryID})
		if err != nil {
			return false, err
		}
		highlighted, _ := value.(bool)
		return highlighted, nil
	}, timeout)
}

func waitForCenteredJournalTranscript(driver selenium.WebDriver, entryID string, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		value, err := webDriver.ExecuteScript(`
			const transcript = [...document.querySelectorAll('[data-journal-transcript]')]
				.find(value => value.dataset.journalTranscript === arguments[0]);
			const highlighted = transcript?.querySelector('[data-journal-currently-spoken]');
			if (!transcript || !highlighted || transcript.scrollHeight <= transcript.clientHeight) {
				return false;
			}
			const transcriptBounds = transcript.getBoundingClientRect();
			const highlightedBounds = highlighted.getBoundingClientRect();
			const distanceFromCenter = Math.abs(
				(highlightedBounds.top + highlightedBounds.height / 2) -
				(transcriptBounds.top + transcriptBounds.height / 2)
			);
			return distanceFromCenter < transcript.clientHeight * 0.1;
		`, []any{entryID})
		if err != nil {
			return false, err
		}
		centered, _ := value.(bool)
		return centered, nil
	}, timeout)
}

func waitForJournalWaveform(driver selenium.WebDriver, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		value, err := webDriver.ExecuteScript(`
			const canvas = document.querySelector(
				"canvas[aria-label='Live recording waveform']"
			);
			if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
			const pixels = canvas
				.getContext('2d')
				.getImageData(0, 0, canvas.width, canvas.height).data;
			return pixels.some((value, index) => index % 4 === 3 && value > 0);
		`, nil)
		if err != nil {
			return false, err
		}
		drawn, _ := value.(bool)
		return drawn, nil
	}, timeout)
}

func journalAudioCount(driver selenium.WebDriver) (int, error) {
	elements, err := driver.FindElements(selenium.ByCSSSelector, "audio[data-entry-id]")
	if err != nil {
		return 0, err
	}
	return len(elements), nil
}

func journalAudioCountRemains(driver selenium.WebDriver, want int, duration time.Duration) error {
	deadline := time.Now().Add(duration)
	for time.Now().Before(deadline) {
		count, err := journalAudioCount(driver)
		if err != nil {
			return err
		}
		if count != want {
			return fmt.Errorf("journal audio count = %d, want %d", count, want)
		}
		time.Sleep(100 * time.Millisecond)
	}
	return nil
}

func journalAudioRemainsPaused(driver selenium.WebDriver, entryID string, duration time.Duration) error {
	deadline := time.Now().Add(duration)
	for time.Now().Before(deadline) {
		value, err := driver.ExecuteScript(`
			const audio = [...document.querySelectorAll('audio[data-entry-id]')]
				.find(value => value.dataset.entryId === arguments[0]);
			return audio?.paused ?? null;
		`, []any{entryID})
		if err != nil {
			return err
		}
		paused, ok := value.(bool)
		if !ok || !paused {
			return fmt.Errorf("journal audio %s resumed", entryID)
		}
		time.Sleep(100 * time.Millisecond)
	}
	return nil
}

func waitForJournalAudioCount(driver selenium.WebDriver, want int, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		count, err := journalAudioCount(webDriver)
		return count == want, err
	}, timeout)
}

func waitForJournalPeriodAudioCount(driver selenium.WebDriver, start string, want int, timeout time.Duration) error {
	return driver.WaitWithTimeout(func(webDriver selenium.WebDriver) (bool, error) {
		elements, err := webDriver.FindElements(
			selenium.ByCSSSelector,
			fmt.Sprintf("[data-journal-period-start='%s'] audio[data-entry-id]", start),
		)
		return len(elements) == want, err
	}, timeout)
}
