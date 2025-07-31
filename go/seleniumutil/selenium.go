package selenium

import (
	"fmt"
	"net"
	"os"

	"github.com/bazelbuild/rules_go/go/runfiles"
	"github.com/tebeka/selenium"
)

// Driver embeds selenium.WebDriver and cleans itself up via Close().
type Driver struct {
	selenium.WebDriver
	svc *selenium.Service
}

// Close satisfies io.Closer.
func (d *Driver) Close() error {
	if d.WebDriver != nil {
		_ = d.WebDriver.Quit()
	}
	if d.svc != nil {
		return d.svc.Stop()
	}
	return nil
}

// New starts chromedriver on a free port, opens a headless Chrome session,
// and returns a Driver ready to use.
func New() (*Driver, error) {
	chrome, err := runfiles.Rlocation(chromiumRlocationPath)
	if err != nil {
		return nil, fmt.Errorf("locate chromium: %w", err)
	}
	driverBin, err := runfiles.Rlocation(chromeDriverRlocationPath)
	if err != nil {
		return nil, fmt.Errorf("locate chromedriver: %w", err)
	}

	// Sanity-check the binaries exist.
	for _, p := range []struct{ path, label string }{
		{chrome, "chromium"}, {driverBin, "chromedriver"},
	} {
		if fi, err := os.Stat(p.path); err != nil || fi.IsDir() {
			return nil, fmt.Errorf("can't find %s at %s", p.label, p.path)
		}
	}

	port, err := freePort()
	if err != nil {
		return nil, err
	}

	svc, err := selenium.NewChromeDriverService(
		driverBin, port,
		selenium.ChromeDriver(chrome), // tell driver where Chromium lives
	)
	if err != nil {
		return nil, fmt.Errorf("start chromedriver: %w", err)
	}

	caps := selenium.Capabilities{
		"browserName": "chrome",
		"goog:chromeOptions": map[string]any{
			"binary": chrome,
			"args": []string{
				"--headless",
				"--no-sandbox",
				"--disable-dev-shm-usage",
			},
		},
	}

	wd, err := selenium.NewRemote(caps,
		fmt.Sprintf("http://localhost:%d/wd/hub", port))
	if err != nil {
		_ = svc.Stop()
		return nil, err
	}

	return &Driver{WebDriver: wd, svc: svc}, nil
}

// freePort asks the kernel for any available TCP port.
func freePort() (int, error) {
	l, err := net.Listen("tcp", ":0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}
