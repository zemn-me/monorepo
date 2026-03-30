package selenium_test

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
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

type ServicePorts struct {
	APIPort          string `json:"@@//project/zemn.me/api/cmd/localserver:localserver_itest_service"`
	DynamoDBPort     string `json:"@@//java/software/amazon/dynamodb:dynamodb"`
	BabyPort         string `json:"@@//ts/pulumi/testing:baby_itest_service"`
	EggsPort         string `json:"@@//ts/pulumi/testing:eggs_itest_service"`
	LuluPort         string `json:"@@//ts/pulumi/testing:lulu_itest_service"`
	DogPort          string `json:"@@//ts/pulumi/testing:pleaseintroducemetoyourdog_itest_service"`
	AnnaPort         string `json:"@@//ts/pulumi/testing:anna_itest_service"`
	KatePort         string `json:"@@//ts/pulumi/testing:kate_itest_service"`
	LucyPort         string `json:"@@//ts/pulumi/testing:lucy_itest_service"`
	LukePort         string `json:"@@//ts/pulumi/testing:luke_itest_service"`
	AvailabilityPort string `json:"@@//ts/pulumi/testing:availability_itest_service"`
}

type analyticsEventRecord struct {
	Id     string `dynamodbav:"id"`
	Origin string `dynamodbav:"origin"`
	Event  struct {
		EventName string `dynamodbav:"eventName"`
		Page      struct {
			URLPath string `dynamodbav:"urlPath"`
		} `dynamodbav:"page"`
	} `dynamodbav:"event"`
}

type analyticsSite struct {
	name        string
	port        func(ServicePorts) string
	path        string
	readyScript string
}

func TestDownstreamAnalyticsBeaconIntegration(t *testing.T) {
	ports, err := servicePorts()
	if err != nil {
		t.Fatalf("service ports: %v", err)
	}

	sites := []analyticsSite{
		{
			name:        "baby.computer",
			port:        func(p ServicePorts) string { return p.BabyPort },
			path:        "/",
			readyScript: `return document.querySelector("canvas, svg") !== null;`,
		},
		{
			name:        "eggsfordogs.com",
			port:        func(p ServicePorts) string { return p.EggsPort },
			path:        "/",
			readyScript: `return document.querySelector("canvas, svg") !== null;`,
		},
		{
			name:        "lulu.computer",
			port:        func(p ServicePorts) string { return p.LuluPort },
			path:        "/",
			readyScript: `return document.querySelector("svg") !== null;`,
		},
		{
			name:        "pleaseintroducemetoyour.dog",
			port:        func(p ServicePorts) string { return p.DogPort },
			path:        "/",
			readyScript: `return document.body && document.body.innerText.includes("Pleaseintroducemetoyour.dog");`,
		},
		{
			name:        "anna.shadwell.im",
			port:        func(p ServicePorts) string { return p.AnnaPort },
			path:        "/",
			readyScript: `return document.body && document.body.innerText.includes("Anna!");`,
		},
		{
			name:        "kate.shadwell.im",
			port:        func(p ServicePorts) string { return p.KatePort },
			path:        "/",
			readyScript: `return document.body && document.body.innerText.includes("Native trees of the UK");`,
		},
		{
			name:        "lucy.shadwell.im",
			port:        func(p ServicePorts) string { return p.LucyPort },
			path:        "/",
			readyScript: `return document.body && document.body.innerText.includes("Hi this is Lucy!");`,
		},
		{
			name:        "luke.shadwell.im/wikitree",
			port:        func(p ServicePorts) string { return p.LukePort },
			path:        "/wikitree",
			readyScript: `return document.title.includes("WikiTree for Luke Shadwell");`,
		},
		{
			name:        "availability.zemn.me",
			port:        func(p ServicePorts) string { return p.AvailabilityPort },
			path:        "/",
			readyScript: `return document.body && document.body.innerText.includes("view on Google calendar");`,
		},
	}

	for _, site := range sites {
		site := site
		t.Run(site.name, func(t *testing.T) {
			root := url.URL{
				Scheme: "http",
				Host:   "localhost:" + site.port(ports),
				Path:   site.path,
			}

			driver, err := seleniumpkg.New()
			if err != nil {
				t.Fatalf("driver: %v", err)
			}
			defer driver.Close()

			if err := driver.Get(root.String()); err != nil {
				t.Fatalf("navigate: %v", err)
			}

			if err := waitForScript(driver, site.readyScript, 15*time.Second); err != nil {
				body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
				t.Fatalf("page did not become ready: %v (body snippet: %v)", err, body)
			}

			sessionID, err := waitForPersistedAnalyticsSessionID(driver, 15*time.Second)
			if err != nil {
				body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
				t.Fatalf("analytics session not persisted: %v (body snippet: %v)", err, body)
			}

			record, err := waitForAnalyticsRecord(t.Context(), sessionID, 20*time.Second)
			if err != nil {
				body, _ := driver.ExecuteScript("return document.body ? document.body.innerHTML : ''", nil)
				t.Fatalf("analytics record not stored: %v (body snippet: %v)", err, body)
			}

			if record.Event.EventName != "page_view" {
				t.Fatalf("unexpected event name: %+v", record)
			}
			if record.Event.Page.URLPath != site.path {
				t.Fatalf("unexpected page path: got %q want %q", record.Event.Page.URLPath, site.path)
			}
			if record.Origin != root.Scheme+"://"+root.Host {
				t.Fatalf("unexpected origin: got %q want %q", record.Origin, root.Scheme+"://"+root.Host)
			}
		})
	}
}

func waitForPersistedAnalyticsSessionID(driver *seleniumpkg.Driver, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		value, err := driver.ExecuteScript(`return window.localStorage.getItem("zemn_analytics_session_id");`, nil)
		if err == nil {
			if text, ok := value.(string); ok && text != "" {
				return text, nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}

	return "", fmt.Errorf("timed out waiting for persisted analytics session id")
}

func waitForScript(driver *seleniumpkg.Driver, script string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		value, err := driver.ExecuteScript(script, nil)
		if err == nil {
			if ready, ok := value.(bool); ok && ready {
				return nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}

	return fmt.Errorf("timed out waiting for readiness script")
}

func servicePorts() (ServicePorts, error) {
	var ports ServicePorts
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil {
		return ServicePorts{}, err
	}
	return ports, nil
}

func dynamoDBRoot() (url.URL, error) {
	ports, err := servicePorts()
	if err != nil {
		return url.URL{}, err
	}
	if ports.DynamoDBPort == "" {
		return url.URL{}, fmt.Errorf("dynamodb port not found in ASSIGNED_PORTS")
	}

	return url.URL{
		Scheme: "http",
		Host:   "localhost:" + ports.DynamoDBPort,
	}, nil
}

func waitForAnalyticsRecord(ctx context.Context, sessionID string, timeout time.Duration) (analyticsEventRecord, error) {
	ddbRoot, err := dynamoDBRoot()
	if err != nil {
		return analyticsEventRecord{}, err
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
		if err == nil {
			for _, item := range out.Items {
				var record analyticsEventRecord
				if unmarshalErr := attributevalue.UnmarshalMap(item, &record); unmarshalErr == nil {
					return record, nil
				}
			}
		}
		lastErr = err
		time.Sleep(250 * time.Millisecond)
	}

	if lastErr != nil {
		return analyticsEventRecord{}, fmt.Errorf("timed out waiting for analytics session %q: last query error: %w", sessionID, lastErr)
	}

	return analyticsEventRecord{}, dumpAnalyticsScan(ctx, client, sessionID)
}

func dumpAnalyticsScan(ctx context.Context, client *dynamodb.Client, sessionID string) error {
	scanOut, scanErr := client.Scan(ctx, &dynamodb.ScanInput{
		TableName:      aws.String("table2"),
		ConsistentRead: aws.Bool(true),
		Limit:          aws.Int32(20),
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
