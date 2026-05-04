package selenium_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
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
		value, err := driver.ExecuteScript(`return window.localStorage.getItem("REACT_QUERY_OFFLINE_CACHE");`, nil)
		if err == nil {
			sessionID := analyticsSessionIDFromPersistedCache(value)
			if sessionID != "" {
				return sessionID, nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}

	return "", fmt.Errorf("timed out waiting for persisted analytics session id")
}

func analyticsSessionIDFromPersistedCache(value any) string {
	text, ok := value.(string)
	if !ok || text == "" {
		return ""
	}

	var persisted struct {
		ClientState struct {
			Queries []struct {
				QueryKey []string `json:"queryKey"`
				State    struct {
					Data string `json:"data"`
				} `json:"state"`
			} `json:"queries"`
		} `json:"clientState"`
	}
	if err := json.Unmarshal([]byte(text), &persisted); err != nil {
		return ""
	}

	for _, query := range persisted.ClientState.Queries {
		if len(query.QueryKey) == 1 && query.QueryKey[0] == "analytics_session_id" {
			return query.State.Data
		}
	}

	return ""
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
			TableName: aws.String("table2"),
			ConsistentRead: aws.Bool(true),
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
