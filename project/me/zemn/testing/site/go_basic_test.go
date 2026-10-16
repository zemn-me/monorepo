package selenium_test

import (
	"testing"
	"time"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
	"github.com/zemn-me/monorepo/project/me/zemn/testing/browserhelpers"
)

func TestOIDCLoginButtonBecomesEnabled(t *testing.T) {
	root, err := browserhelpers.FrontendRoot()
	if err != nil {
		t.Fatalf("could not find frontend root: %v", err)
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

	button, err := browserhelpers.WaitForLoginButtonReady(driver, 20*time.Second)
	if err != nil {
		t.Fatalf("login button did not become enabled: %v", err)
	}

	label, err := button.GetAttribute("aria-label")
	if err != nil {
		t.Fatalf("read login button label: %v", err)
	}
	if label != "Authenticate with OIDC" {
		t.Fatalf("unexpected aria-label: got %q", label)
	}

}
