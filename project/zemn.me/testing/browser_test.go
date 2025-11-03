// browser_test exercises the zemn.me static site plus the local API server.
package selenium_test

import (
	"encoding/json"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium/log"

	seleniumpkg "github.com/zemn-me/monorepo/go/seleniumutil"
)

type ServicePorts struct {
	NextServerPort string `json:"@@//project/zemn.me:itest_service"`
}

func servicePorts() (p ServicePorts, err error) {
	if err = json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &p); err != nil {
		return
	}

	return
}

func nextServerRoot() (u url.URL, err error) {
	ports, err := servicePorts()
	if err != nil {
		return
	}

	return url.URL{
		Scheme: "http",
		Host:   "localhost:" + ports.NextServerPort,
	}, nil
}

func testEndpointHasNoLogErrors(t *testing.T, ep string) {
	d, err := seleniumpkg.New()
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	defer d.Close()

	u, err := url.Parse(ep)
	if err != nil {
		t.Fatal(err)
	}

	if err := d.Get(ep); err != nil {
		t.Fatalf("get: %v", err)
	}

	origin := url.URL{
		Scheme: u.Scheme,
		Host:   u.Host,
	}

	time.Sleep(1 * time.Second)

	logs, _ := d.Log(log.Browser)
	cu, _ := d.CurrentURL()
	filtered := filterErrorsWeDontCareAbout(logs)
	// don't error if we were redirected
	if len(filtered) > 0 && strings.HasPrefix(cu, origin.String()) {
		t.Fatalf("%+q logged %+v", ep, filtered)
	}
}

func filterErrorsWeDontCareAbout(in []log.Message) (out []log.Message) {
	out = make([]log.Message, 0, len(in))
	for _, l := range in {
		if strings.Contains(l.Message, "source map") ||
			strings.Contains(l.Message, "react-dev-overlay") {
			continue
		}
		out = append(out, l)
	}

	return
}

func TestRootHasNoErrors(t *testing.T) {
	root, err := nextServerRoot()
	if err != nil {
		t.Fatalf("could not find next server root: %v", err)
	}

	testEndpointHasNoLogErrors(t, root.String())
}
