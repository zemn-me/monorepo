package testing_test

import (
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func newGameBrowser(t *testing.T, arguments ...string) *seleniumutil.Driver {
	t.Helper()
	arguments = append([]string{"--use-angle=swiftshader", "--enable-unsafe-swiftshader"}, arguments...)
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{
		"pageLoadStrategy":  "eager",
		"goog:loggingPrefs": map[string]string{"browser": "ALL"},
	}, arguments...)
	if err != nil {
		t.Fatal(err)
	}
	// Simulated time does not remove synchronous Wasm scenario generation or
	// software rendering. Both multiplayer peers need the same CPU-time budget.
	if err := driver.SetAsyncScriptTimeout(2 * time.Minute); err != nil {
		driver.Close()
		t.Fatal(err)
	}
	return driver
}
