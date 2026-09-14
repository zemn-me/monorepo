package selenium_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/tebeka/selenium"
	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

type journalOAuthTransport struct{ token string }

func (transport journalOAuthTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	request = request.Clone(request.Context())
	request.Header.Set("Authorization", "Bearer "+transport.token)
	return http.DefaultTransport.RoundTrip(request)
}
func TestJournalMCPOAuthBrowserConnection(t *testing.T) {
	api, err := apiRoot()
	if err != nil {
		t.Fatal(err)
	}
	frontend, err := nextServerRoot()
	if err != nil {
		t.Fatal(err)
	}
	resource := api.String() + "/journal/mcp"
	callback := frontend.String() + "/journal"
	requestJSON := func(method, path, body, contentType string, status int) map[string]any {
		t.Helper()
		request, err := http.NewRequestWithContext(t.Context(), method, api.String()+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if contentType != "" {
			request.Header.Set("Content-Type", contentType)
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != status {
			t.Fatalf("%s: status %d, want %d", path, response.StatusCode, status)
		}
		result := map[string]any{}
		if status != 204 && path != "/oauth2/mcp/revoke" {
			if err = json.NewDecoder(response.Body).Decode(&result); err != nil {
				t.Fatal(err)
			}
		}
		return result
	}
	metadata := requestJSON("GET", "/.well-known/oauth-authorization-server", "", "", 200)
	if metadata["registration_endpoint"] != api.String()+"/oauth2/register" {
		t.Fatal("registration discovery mismatch")
	}
	encoded, _ := json.Marshal(map[string]any{"client_name": "Browser diary assistant", "redirect_uris": []string{callback}, "grant_types": []string{"authorization_code", "refresh_token"}, "token_endpoint_auth_method": "none"})
	client := requestJSON("POST", "/oauth2/register", string(encoded), "application/json", 201)["client_id"].(string)
	verifier := strings.Repeat("v", 43)
	hash := sha256.Sum256([]byte(verifier))
	params := url.Values{"client_id": {client}, "redirect_uri": {callback}, "response_type": {"code"}, "resource": {resource}, "scope": {"journal_read"}, "state": {"browser-connection-state"}, "code_challenge_method": {"S256"}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}}
	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err = driver.Get(api.String() + "/oauth2/authorize?" + params.Encode()); err != nil {
		t.Fatal(err)
	}
	if _, err = waitForElement(driver, selenium.ByXPATH, "//p[contains(.,'Browser diary assistant')]", 30*time.Second); err != nil {
		t.Fatalf("consent details: %v", err)
	}
	if err = performOIDCLogin(driver, "Login as local subject", 30*time.Second); err != nil {
		t.Fatal(err)
	}
	approve, err := waitForElement(driver, selenium.ByXPATH, "//button[normalize-space(.)='Allow journal access']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err = approve.Click(); err != nil {
		t.Fatal(err)
	}
	var code string
	if err = driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		current, err := d.CurrentURL()
		if err != nil {
			return false, err
		}
		u, err := url.Parse(current)
		if err != nil {
			return false, err
		}
		code = u.Query().Get("code")
		if code != "" && (u.Query().Get("state") != "browser-connection-state" || u.Query().Get("iss") != api.String()) {
			t.Fatal("authorization response lost state or issuer")
		}
		return code != "", nil
	}, 30*time.Second); err != nil {
		t.Fatal("consent did not return an authorization code", err)
	}
	form := url.Values{"grant_type": {"authorization_code"}, "client_id": {client}, "code": {code}, "redirect_uri": {callback}, "resource": {resource}, "code_verifier": {verifier}}
	tokens := requestJSON("POST", "/oauth2/mcp/token", form.Encode(), "application/x-www-form-urlencoded", 200)
	requestJSON("POST", "/oauth2/mcp/token", form.Encode(), "application/x-www-form-urlencoded", 400)
	httpClient := &http.Client{Transport: journalOAuthTransport{token: tokens["access_token"].(string)}}
	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "browser-diary-test", Version: "1"}, nil)
	session, err := mcpClient.Connect(t.Context(), &mcp.StreamableClientTransport{Endpoint: resource, HTTPClient: httpClient, DisableStandaloneSSE: true}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	tools, err := session.ListTools(t.Context(), nil)
	if err != nil || len(tools.Tools) != 3 {
		t.Fatalf("MCP tools unavailable: %v", err)
	}
	result, err := session.CallTool(t.Context(), &mcp.CallToolParams{Name: "search_journal", Arguments: map[string]any{}})
	if err != nil || result.IsError {
		t.Fatalf("journal search failed: %v", err)
	}
	renewal := url.Values{"grant_type": {"refresh_token"}, "client_id": {client}, "refresh_token": {tokens["refresh_token"].(string)}, "resource": {resource}}
	refreshed := requestJSON("POST", "/oauth2/mcp/token", renewal.Encode(), "application/x-www-form-urlencoded", 200)
	revoke := url.Values{"client_id": {client}, "token": {refreshed["refresh_token"].(string)}}
	requestJSON("POST", "/oauth2/mcp/revoke", revoke.Encode(), "application/x-www-form-urlencoded", 200)
	if _, err = session.ListTools(context.Background(), nil); err == nil {
		t.Fatal("revoked connection retained journal access")
	}
	if err = driver.Get(api.String() + "/oauth2/authorize?" + params.Encode()); err != nil {
		t.Fatal(err)
	}
	cancel, err := waitForElement(driver, selenium.ByXPATH, "//button[normalize-space(.)='Cancel connection']", 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err = cancel.Click(); err != nil {
		t.Fatal(err)
	}
	if err = driver.WaitWithTimeout(func(d selenium.WebDriver) (bool, error) {
		current, err := d.CurrentURL()
		if err != nil {
			return false, err
		}
		u, err := url.Parse(current)
		if err != nil {
			return false, err
		}
		return u.Query().Get("error") == "access_denied" && u.Query().Get("code") == "" && u.Query().Get("state") == "browser-connection-state", nil
	}, 30*time.Second); err != nil {
		t.Fatal("denied connection did not return access_denied", err)
	}
}
