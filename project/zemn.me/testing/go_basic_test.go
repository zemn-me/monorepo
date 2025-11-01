package selenium_test

import (
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestUseOIDCLocalIssuerRequestURL(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}

	driver, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer driver.Close()

	grievancePortal := root
	grievancePortal.Path = "/grievanceportal"
	if err := driver.Get(grievancePortal.String()); err != nil {
		t.Fatalf("navigate grievance portal: %v", err)
	}

	button, err := waitForElement(driver, selenium.ByCSSSelector, "button[data-testid='oidc-login-button']", 20*time.Second)
	if err != nil {
		t.Fatalf("find oidc login button: %v", err)
	}

	ports, err := servicePorts()
	if err != nil {
		t.Fatalf("could not parse service ports: %v", err)
	}
	expectedIssuer := ""
	if ports.OIDCProvider != "" {
		expectedIssuer = "http://localhost:" + ports.OIDCProvider
	} else if envIssuer := os.Getenv("ZEMN_TEST_OIDC_ISSUER"); envIssuer != "" {
		expectedIssuer = envIssuer
	} else {
		expectedIssuer = "http://localhost:43111"
	}

	requestURL, err := waitForRequestURLFromButton(driver, expectedIssuer, 20*time.Second)
	if err != nil {
		state, _ := driver.ExecuteScript(`(function() {
		const btn = document.querySelector("button[data-testid='oidc-login-button']");
		let buttonURL = null;
		if (btn && btn.dataset && typeof btn.dataset.requestUrl === "string") {
			buttonURL = btn.dataset.requestUrl;
		}
		return {
			requestURL: typeof window.__oidcRequestURL === "string" ? window.__oidcRequestURL : null,
			buttonURL,
			useTestIssuer: typeof window.__oidcUseTestIssuer === "boolean" ? window.__oidcUseTestIssuer : null,
			effectiveIssuer: typeof window.__oidcEffectiveIssuer === "string" ? window.__oidcEffectiveIssuer : null,
		};
	})();`, nil)
		probe, _ := driver.ExecuteScript(`(function() {
		const btn = document.querySelector("button[data-testid='oidc-login-button']");
		let dataUrl = null;
		if (btn && btn.dataset && typeof btn.dataset.requestUrl === "string" && btn.dataset.requestUrl.length > 0) {
			dataUrl = btn.dataset.requestUrl;
		}
		const globalUrl = typeof window.__oidcRequestURL === "string" ? window.__oidcRequestURL : null;
		if (dataUrl) {
			return dataUrl;
		}
		if (globalUrl) {
			return globalUrl;
		}
		return "";
	})();`, nil)
		t.Fatalf("oidc request url: %v (state: %v, probe: %v)", err, state, probe)
	}
	if requestURL == "" {
		t.Fatalf("empty request url on login button")
	}
	if !strings.HasPrefix(requestURL, expectedIssuer) {
		t.Fatalf("unexpected issuer prefix: got %q want prefix %q", requestURL, expectedIssuer)
	}

	requestParsed, err := url.Parse(requestURL)
	if err != nil {
		t.Fatalf("parse request url: %v", err)
	}

	query := requestParsed.Query()

	expectedClientID := os.Getenv("ZEMN_TEST_OIDC_CLIENT_ID")
	if expectedClientID == "" {
		expectedClientID = "integration-test-client"
	}
	if clientID := query.Get("client_id"); clientID != expectedClientID {
		t.Fatalf("unexpected client_id: got %q want %q", clientID, expectedClientID)
	}
	if responseType := query.Get("response_type"); responseType != "id_token" {
		t.Fatalf("unexpected response_type: got %q", responseType)
	}
	if scope := query.Get("scope"); scope != "openid" {
		t.Fatalf("unexpected scope: got %q", scope)
	}

	nonce := query.Get("nonce")
	state := query.Get("state")
	if nonce == "" {
		t.Fatalf("missing nonce in request url")
	}
	if state == "" {
		t.Fatalf("missing state in request url")
	}
	if state != nonce {
		t.Fatalf("state and nonce differ: state=%q nonce=%q", state, nonce)
	}

	redirect := query.Get("redirect_uri")
	if redirect == "" {
		t.Fatalf("missing redirect_uri in request url")
	}

	redirectParsed, err := url.Parse(redirect)
	if err != nil {
		t.Fatalf("parse redirect uri: %v", err)
	}
	if redirectParsed.Host != root.Host {
		t.Fatalf("unexpected redirect host: got %q want %q", redirectParsed.Host, root.Host)
	}
	if redirectParsed.Scheme != root.Scheme {
		t.Fatalf("unexpected redirect scheme: got %q want %q", redirectParsed.Scheme, root.Scheme)
	}

	if disabledAny, err := driver.ExecuteScript("return arguments[0].disabled;", []any{button}); err == nil {
		if disabled, _ := disabledAny.(bool); disabled {
			t.Fatalf("login button disabled despite request url")
		}
	}

	if globalAny, err := driver.ExecuteScript("return window.__oidcRequestURL ?? null;", nil); err == nil {
		if global, _ := globalAny.(string); global != "" && global != requestURL {
			t.Fatalf("window.__oidcRequestURL mismatch: got %q want %q", global, requestURL)
		}
	}
}
