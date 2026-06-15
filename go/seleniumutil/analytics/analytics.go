package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
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

const analyticsSessionStorageKey = "ZEMN_ANALYTICS_SESSION_ID"

func AssertSiteSendsAnalytics(t *testing.T, siteLabel string) {
	t.Helper()

	root, err := serviceRoot(siteLabel)
	if err != nil {
		t.Fatalf("site root: %v", err)
	}

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(root.String()); err != nil {
		t.Fatalf("navigate analytics probe: %v", err)
	}

	sessionID, err := waitForAnalyticsSessionID(driver, 10*time.Second)
	if err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("analytics session not persisted: %v (body snippet: %v, browser logs: %+v)", err, body, browserLogs)
	}

	if err := waitForAnalyticsRecord(t.Context(), sessionID, 15*time.Second); err != nil {
		body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
		browserLogs, _ := driver.Log(log.Browser)
		t.Fatalf("analytics record not stored: %v (body snippet: %v, browser logs: %+v)", err, body, browserLogs)
	}
}

func serviceRoot(label string) (url.URL, error) {
	ports, err := assignedPorts()
	if err != nil {
		return url.URL{}, err
	}
	port := ports[label]
	if port == "" {
		return url.URL{}, fmt.Errorf("%s port not found in ASSIGNED_PORTS", label)
	}

	return url.URL{
		Scheme: "http",
		Host:   "localhost:" + port,
	}, nil
}

func assignedPorts() (map[string]string, error) {
	ports := map[string]string{}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		return nil, err
	}
	return ports, nil
}

func waitForAnalyticsSessionID(driver *seleniumpkg.Driver, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		value, err := driver.ExecuteScript(
			fmt.Sprintf(`return window.localStorage.getItem(%q);`, analyticsSessionStorageKey),
			nil,
		)
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
	ddbRoot, err := serviceRoot("@@//java/software/amazon/dynamodb:dynamodb")
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
