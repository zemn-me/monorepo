package selenium_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestAnalyticsBeaconIntegration(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}
	apiBase, err := apiRoot()
	if err != nil {
		t.Fatalf("api root: %v", err)
	}

	directSessionID := fmt.Sprintf("itest-direct-%d", time.Now().UnixNano())
	if err := postAnalyticsEvent(t.Context(), apiBase.String()+"/analytics/beacon", root.String(), directSessionID); err != nil {
		t.Fatalf("direct analytics post: %v", err)
	}
	if err := waitForAnalyticsRecord(t.Context(), directSessionID, 5*time.Second); err != nil {
		t.Fatalf("direct analytics record not stored: %v", err)
	}

	sessionID := fmt.Sprintf("itest-%d", time.Now().UnixNano())
	probeURL := root
	probeURL.Path = "/"

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(probeURL.String()); err != nil {
		t.Fatalf("navigate analytics probe: %v", err)
	}

	if err := waitForText(driver, "internationally recognised expert", 10*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("home page load: %v (body snippet: %v)", err, body)
	}

	sessionID, err = waitForPersistedAnalyticsSessionID(driver, 10*time.Second)
	if err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		t.Fatalf("analytics session not persisted: %v (body snippet: %v)", err, body)
	}

	if err := waitForAnalyticsRecord(t.Context(), sessionID, 15*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("analytics record not stored: %v (body snippet: %v, browser logs: %+v)", err, body, browserLogs)
	}
}

func waitForPersistedAnalyticsSessionID(driver *seleniumpkg.Driver, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		value, err := driver.ExecuteScript(`return window.localStorage.getItem("ZEMN_ANALYTICS_SESSION_ID");`, nil)
		if err == nil {
			if sessionID, ok := value.(string); ok && sessionID != "" {
				return sessionID, nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}

	return "", fmt.Errorf("timed out waiting for persisted analytics session id")
}

func waitForAnalyticsRecord(ctx context.Context, sessionID string, timeout time.Duration) error {
	ddbRoot, err := dynamoDBRoot()
	if err != nil {
		return err
	}

	client := dynamodb.New(dynamodb.Options{
		EndpointResolver: dynamodb.EndpointResolverFromURL(ddbRoot.String()),
		Retryer:          aws.NopRetryer{},
		Credentials: credentials.StaticCredentialsProvider{
			Value: aws.Credentials{
				AccessKeyID:     "LOCALSTACK",
				SecretAccessKey: "LOCALSTACK",
			},
		},
	})

	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		out, err := client.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String("table2"),
			ConsistentRead:         aws.Bool(true),
			KeyConditionExpression: aws.String("id = :id"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":id": &types.AttributeValueMemberS{Value: sessionID},
			},
		})
		if err == nil && len(out.Items) > 0 {
			return nil
		}
		lastErr = err
		time.Sleep(250 * time.Millisecond)
	}

	if lastErr != nil {
		return fmt.Errorf("timed out waiting for analytics session %q: last query error: %w", sessionID, lastErr)
	}

	scanOut, scanErr := client.Scan(ctx, &dynamodb.ScanInput{
		TableName:      aws.String("table2"),
		ConsistentRead: aws.Bool(true),
		Limit:          aws.Int32(10),
	})
	if scanErr != nil {
		return fmt.Errorf("timed out waiting for analytics session %q; scan failed: %w", sessionID, scanErr)
	}

	items := make([]string, 0, len(scanOut.Items))
	for _, item := range scanOut.Items {
		id, _ := item["id"].(*types.AttributeValueMemberS)
		when, _ := item["when"].(*types.AttributeValueMemberS)
		items = append(items, fmt.Sprintf("%q@%q", valueOrEmpty(id), valueOrEmpty(when)))
	}

	return fmt.Errorf("timed out waiting for analytics session %q; scanned %d item(s): %s", sessionID, len(scanOut.Items), strings.Join(items, ", "))
}

func valueOrEmpty(v *types.AttributeValueMemberS) string {
	if v == nil {
		return ""
	}
	return v.Value
}

func postAnalyticsEvent(ctx context.Context, endpoint string, origin string, sessionID string) error {
	body, err := json.Marshal(map[string]any{
		"eventName": "integration_probe_http",
		"eventTime": time.Now().UTC().Format(time.RFC3339Nano),
		"eventId":   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		"sessionId": sessionID,
		"page": map[string]any{
			"urlPath": "/",
		},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", origin)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	return nil
}

func TestAdminAnalyticsPanelEndToEnd(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatal(err)
	}
	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.ResizeWindow("", 1280, 900); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if t.Failed() {
			body, _ := driver.ExecuteScript("return document.body.innerText", nil)
			logs, _ := driver.Log(log.Browser)
			t.Logf("analytics panel: %v; browser logs: %+v", body, logs)
		}
	}()

	// A real page navigation emits the page view used in the report.
	root.Path = "/"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "internationally recognised expert", 20*time.Second); err != nil {
		t.Fatal(err)
	}
	root.Path = "/admin/analytics"
	if err := driver.Get(root.String()); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForLoginButtonReady(driver, 20*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "Complete range", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "Traffic over time", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if outputDir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); outputDir != "" {
		if screenshot, err := driver.Screenshot(); err == nil {
			if err := os.WriteFile(filepath.Join(outputDir, "analytics-desktop.png"), screenshot, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	views, err := driver.FindElement(selenium.ByCSSSelector, "output[aria-label='Page views']")
	if err != nil {
		t.Fatal(err)
	}
	text, err := views.Text()
	if err != nil || text == "0" || text == "" {
		t.Fatalf("expected real page views, got %q (%v)", text, err)
	}

	search, err := driver.FindElement(selenium.ByCSSSelector, "input[type='search']")
	if err != nil {
		t.Fatal(err)
	}
	if err := search.SendKeys("no-such-page-analytics-itest"); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "No events match this selection.", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := expectElementText(driver, "output[aria-label='Page views']", "0", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	clear, err := driver.FindElement(selenium.ByXPATH, "//button[normalize-space()='Clear filters']")
	if err != nil {
		t.Fatal(err)
	}
	if err := clear.Click(); err != nil {
		t.Fatal(err)
	}
	if err := expectInputValue(driver, "input[type='search']", "", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	page, err := driver.FindElement(selenium.ByXPATH, "//section[@aria-label='Top pages']//button[normalize-space()='/']")
	if err != nil {
		t.Fatal(err)
	}
	if err := page.Click(); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "Page: /", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := expectElementText(driver, "output[aria-label='Pages viewed']", "1", 10*time.Second); err != nil {
		t.Fatal(err)
	}
	payload, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Recent events'] details summary", 10*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := payload.Click(); err != nil {
		t.Fatal(err)
	}
	if _, err := waitForElement(driver, selenium.ByCSSSelector, "section[aria-label='Recent events'] details[open] pre", 10*time.Second); err != nil {
		t.Fatal(err)
	}

	period, err := driver.FindElement(selenium.ByXPATH, "//label[contains(., 'Period')]/select/option[@value='1']")
	if err != nil {
		t.Fatal(err)
	}
	if err := period.Click(); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "Complete range", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	bars, err := driver.FindElements(selenium.ByCSSSelector, "[aria-label='Daily page views'] [role='listitem']")
	if err != nil || len(bars) != 1 {
		t.Fatalf("today should have one daily bucket, got %d (%v)", len(bars), err)
	}
	refresh, err := driver.FindElement(selenium.ByXPATH, "//button[normalize-space()='Refresh']")
	if err != nil {
		t.Fatal(err)
	}
	if err := refresh.Click(); err != nil {
		t.Fatal(err)
	}
	if err := waitForText(driver, "Complete range", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := driver.ResizeWindow("", 390, 844); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		value, err := wd.ExecuteScript("return document.documentElement.scrollWidth <= window.innerWidth", nil)
		return value == true, err
	}, 5*time.Second); err != nil {
		t.Fatalf("mobile layout overflows: %v", err)
	}
	if outputDir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); outputDir != "" {
		if screenshot, err := driver.Screenshot(); err == nil {
			if err := os.WriteFile(filepath.Join(outputDir, "analytics-mobile.png"), screenshot, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}

}
