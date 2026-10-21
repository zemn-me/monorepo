package testing_test

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func siteURL(t *testing.T) string {
	t.Helper()
	var ports struct {
		Site string `json:"@@//project/vanilla_conquer/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("site port: %v", err)
	}
	return "http://localhost:" + ports.Site
}

func newBrowser(t *testing.T, width, height int) *seleniumutil.Driver {
	t.Helper()
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{"pageLoadStrategy": "eager", "goog:loggingPrefs": map[string]string{"browser": "ALL"}}, "--use-angle=swiftshader", "--enable-unsafe-swiftshader")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { driver.Close() })
	t.Cleanup(func() {
		entries, _ := driver.Log(log.Browser)
		for _, entry := range entries {
			if strings.Contains(entry.Message, "RuntimeError") || strings.Contains(entry.Message, "The game stopped") {
				t.Error(entry.Message)
			}
			if t.Failed() {
				t.Log(entry.Message)
			}
		}
		snapshot(t, driver, strings.ReplaceAll(t.Name(), "/", "-"))
	})
	if err := driver.SetAsyncScriptTimeout(30 * time.Second); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": width, "height": height, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	return driver
}

func snapshot(t *testing.T, driver *seleniumutil.Driver, name string) image.Image {
	t.Helper()
	data, err := driver.Screenshot()
	if err != nil {
		t.Fatal(err)
	}
	picture, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
		if err := os.WriteFile(filepath.Join(dir, name+".png"), data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	return picture
}

func advance(t *testing.T, clock *seleniumutil.VirtualClock, duration time.Duration) {
	t.Helper()
	if clock == nil {
		time.Sleep(duration)
		return
	}
	for duration > 0 {
		step := min(duration, 100*time.Millisecond)
		if err := clock.Advance(step); err != nil {
			t.Fatal(err)
		}
		duration -= step
	}
}

func enter(t *testing.T, canvas selenium.WebElement, clock *seleniumutil.VirtualClock, duration time.Duration) {
	t.Helper()
	if err := canvas.SendKeys(selenium.EnterKey); err != nil {
		t.Fatal(err)
	}
	advance(t, clock, duration)
}

func click(t *testing.T, driver *seleniumutil.Driver, clock *seleniumutil.VirtualClock, x, y int) {
	t.Helper()
	for _, event := range []map[string]any{
		{"type": "mouseMoved", "x": x, "y": y},
		{"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1},
		{"type": "mouseReleased", "x": x, "y": y, "button": "left", "buttons": 0, "clickCount": 1},
	} {
		if err := driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", event); err != nil {
			t.Fatal(err)
		}
		advance(t, clock, 100*time.Millisecond)
	}
}

func assertRunning(t *testing.T, driver *seleniumutil.Driver) bool {
	t.Helper()
	value, err := driver.ExecuteScript("return document.querySelector('[role=status]')?.textContent", nil)
	if err != nil {
		t.Fatal(err)
	}
	message, _ := value.(string)
	if strings.Contains(message, "Could not") || strings.Contains(message, "stopped") {
		t.Fatalf("game failed: %s", message)
	}
	return strings.Contains(message, "Game running")
}

func movieRequests(t *testing.T, driver *seleniumutil.Driver) int {
	t.Helper()
	value, err := driver.ExecuteScript(`return performance.getEntriesByType('resource').filter(r=>r.name.includes('.cinematic.gz')).length`, nil)
	if err != nil {
		t.Fatal(err)
	}
	return int(value.(float64))
}

func waitMovie(t *testing.T, driver *seleniumutil.Driver, count int) {
	t.Helper()
	if err := driver.WaitWithTimeout(func(selenium.WebDriver) (bool, error) {
		value, err := driver.ExecuteScript(`return document.querySelector('[role=status]')?.textContent.includes('Game running')`, nil)
		return err == nil && value == true && movieRequests(t, driver) >= count, err
	}, 60*time.Second); err != nil {
		t.Fatalf("cinematic download: %v", err)
	}
}

func button(t *testing.T, driver *seleniumutil.Driver, text string) selenium.WebElement {
	t.Helper()
	var result selenium.WebElement
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		var err error
		result, err = w.FindElement(selenium.ByXPATH, "//button[normalize-space(.)='"+text+"']")
		if err != nil {
			return false, nil
		}
		return result.IsDisplayed()
	}, 60*time.Second); err != nil {
		t.Fatalf("%s button: %v", text, err)
	}
	return result
}

func waitMenu(t *testing.T, driver *seleniumutil.Driver, clock *seleniumutil.VirtualClock, name string, menuY int) {
	t.Helper()
	if err := driver.WaitWithTimeout(func(selenium.WebDriver) (bool, error) {
		advance(t, clock, 100*time.Millisecond)
		if !assertRunning(t, driver) {
			return false, nil
		}
		picture := snapshot(t, driver, name+"-menu")
		colored := 0
		for y := menuY; y < menuY+21; y++ {
			for x := 260; x < 540; x++ {
				r, g, b, _ := picture.At(x, y).RGBA()
				if max(r, g, b)-min(r, g, b) > 10000 {
					colored++
				}
			}
		}
		return colored > 100, nil
	}, 90*time.Second); err != nil {
		t.Fatalf("interactive menu: %v", err)
	}
}

func TestBrowserCampaigns(t *testing.T) {
	base := siteURL(t)
	for _, game := range []struct {
		name, route, faction string
		menuY                int
	}{
		{"red-alert-allies", "red-alert", "allies", 268},
		{"red-alert-soviet", "red-alert", "soviet", 268},
		{"command-and-conquer", "command-and-conquer", "gdi", 112},
	} {
		t.Run(game.name, func(t *testing.T) {
			driver := newBrowser(t, 800, 600)
			var clock *seleniumutil.VirtualClock
			if game.route != "red-alert" {
				var err error
				clock, err = seleniumutil.NewVirtualClock(driver)
				if err != nil {
					t.Fatal(err)
				}
			}
			// Red Alert cinematics use real Web Audio buffer sources and their
			// completion events, which the ScriptProcessor test clock does not model.
			if err := driver.Get(base + "/experiments/" + game.route); err != nil {
				t.Fatal(err)
			}
			if game.route == "red-alert" {
				if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
					button, err := w.FindElement(selenium.ByCSSSelector, "button")
					if err != nil {
						return false, nil
					}
					return button.IsDisplayed()
				}, 90*time.Second); err != nil {
					t.Fatalf("start button: %v", err)
				}
				button, err := driver.FindElement(selenium.ByCSSSelector, "button")
				if err != nil {
					t.Fatal(err)
				}
				if count := movieRequests(t, driver); count != 0 {
					t.Fatalf("cinematics downloaded before starting: %d", count)
				}
				value, err := driver.ExecuteScript(`return performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.gz')&&!r.name.includes('.cinematic.gz')).reduce((n,r)=>n+r.encodedBodySize,0)`, nil)
				if err != nil || value.(float64) > 30*1024*1024 {
					t.Fatalf("initial game data exceeds 30 MiB: %v, %v", value, err)
				}
				for _, viewport := range []struct{ width, height int }{{390, 844}, {800, 600}} {
					if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": viewport.width, "height": viewport.height, "deviceScaleFactor": 1, "mobile": false}); err != nil {
						t.Fatal(err)
					}
					value, err := driver.ExecuteScript(`const b=arguments[0],r=b.getBoundingClientRect();return document.activeElement===b&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.height>=44&&document.documentElement.scrollWidth<=innerWidth`, []interface{}{button})
					if err != nil || value != true {
						t.Fatalf("start button visibility/focus at width %d: %v, %v", viewport.width, value, err)
					}
					snapshot(t, driver, game.name+"-ready-"+strconv.Itoa(viewport.width))
				}
				if err := button.SendKeys(selenium.EnterKey); err != nil {
					t.Fatal(err)
				}
				waitMovie(t, driver, 1)
				advance(t, clock, 3*time.Second)
				snapshot(t, driver, game.name+"-intro")
				advance(t, clock, 10*time.Second) // Let the intro finish naturally.
			}
			waitMenu(t, driver, clock, game.name, game.menuY)
			if game.route == "red-alert" && movieRequests(t, driver) != 1 {
				t.Fatal("unrequested movies downloaded at startup")
			}
			canvas, err := driver.FindElement(selenium.ByCSSSelector, "canvas")
			if err != nil {
				t.Fatal(err)
			}
			// Keyboard-only WebDriver starts its pointer at the window corner.
			// Keep it inside the map so native edge scrolling cannot hide the action.
			if err := driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", map[string]any{"type": "mouseMoved", "x": 600, "y": 350}); err != nil {
				t.Fatal(err)
			}
			enter(t, canvas, clock, 2*time.Second) // Start New Game.
			enter(t, canvas, clock, 3*time.Second) // Normal difficulty.
			if game.route == "red-alert" {
				if game.faction == "soviet" {
					// The native dialog displays Allies, Soviet, Cancel.
					if err := canvas.SendKeys(selenium.RightArrowKey); err != nil {
						t.Fatal(err)
					}
				}
				enter(t, canvas, clock, 4*time.Second) // Faction and its first mission briefing movie.
				waitMovie(t, driver, 2)
				firstMovie := snapshot(t, driver, game.name+"-briefing-movie")
				advance(t, clock, 2*time.Second)
				nextMovie := snapshot(t, driver, game.name+"-briefing-movie-next")
				changed := 0
				for y := 80; y < 500; y++ {
					for x := 50; x < 750; x++ {
						if firstMovie.At(x, y) != nextMovie.At(x, y) {
							changed++
						}
					}
				}
				if changed < 1000 {
					t.Fatalf("briefing movie did not animate: %d changed pixels", changed)
				}
				if err := canvas.SendKeys(selenium.EscapeKey); err != nil {
					t.Fatal(err)
				}
				advance(t, clock, 15*time.Second) // Skip the briefing into the mission.
			} else {
				click(t, driver, clock, 200, 300) // GDI in the original faction selector.
				advance(t, clock, 15*time.Second)
			}
			if !assertRunning(t, driver) {
				t.Fatal("engine did not remain running")
			}
			first := snapshot(t, driver, game.name+"-mission")
			// Gameplay's credit counter has a textured control bar at the top;
			// the title, faction selector, and briefing screens do not.
			controls := 0
			for y := 52; y < 66; y++ {
				for x := 420; x < 570; x++ {
					r, g, b, _ := first.At(x, y).RGBA()
					if min(r, g, b) > 5000 && max(r, g, b)-min(r, g, b) < 15000 {
						controls++
					}
				}
			}
			if controls < 500 {
				t.Fatalf("campaign did not reach the map (control pixels: %d)", controls)
			}
			advance(t, clock, 3*time.Second)
			next := snapshot(t, driver, game.name+"-simulation")
			changed := 0
			for y := 80; y < 500; y++ {
				for x := 50; x < 750; x++ {
					if first.At(x, y) != next.At(x, y) {
						changed++
					}
				}
			}
			if changed < 60 {
				t.Fatalf("mission simulation did not animate (changed pixels: %d)", changed)
			}
		})
	}
}

func TestDownloadFailure(t *testing.T) {
	base := siteURL(t)
	for _, width := range []int{800, 390} {
		t.Run(strconv.Itoa(width), func(t *testing.T) {
			driver := newBrowser(t, width, 844)
			for _, command := range []struct {
				name string
				args map[string]any
			}{
				{"Network.enable", map[string]any{}},
				{"Network.setBlockedURLs", map[string]any{"urls": []string{"*.gz"}}},
			} {
				if err := driver.ExecuteChromiumCommand(command.name, command.args); err != nil {
					t.Fatal(err)
				}
			}
			if err := driver.Get(base + "/experiments/red-alert"); err != nil {
				t.Fatal(err)
			}
			if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
				status, err := w.FindElement(selenium.ByCSSSelector, "[role=status]")
				if err != nil {
					return false, nil
				}
				text, err := status.Text()
				if err != nil || !strings.Contains(text, "Could not start the game") {
					return false, err
				}
				value, err := w.ExecuteScript(`const s=arguments[0],r=s.getBoundingClientRect();return document.activeElement===s&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth`, []interface{}{status})
				return value == true, err
			}, 30*time.Second); err != nil {
				t.Fatalf("download error is not visible and focused: %v", err)
			}
		})
	}
}

func TestCinematicDownloadFailure(t *testing.T) {
	for _, scenario := range []struct {
		width int
		retry bool
	}{{390, true}, {800, false}} {
		t.Run(strconv.Itoa(scenario.width), func(t *testing.T) {
			driver := newBrowser(t, scenario.width, 844)
			if err := driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
				t.Fatal(err)
			}
			if err := driver.ExecuteChromiumCommand("Network.setBlockedURLs", map[string]any{"urls": []string{"*.cinematic.gz"}}); err != nil {
				t.Fatal(err)
			}
			if err := driver.Get(siteURL(t) + "/experiments/red-alert"); err != nil {
				t.Fatal(err)
			}
			if err := button(t, driver, "Start Red Alert").Click(); err != nil {
				t.Fatal(err)
			}
			button(t, driver, "Retry")
			if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
				value, err := w.ExecuteScript(`const s=document.querySelector('[role=status]'),r=s.getBoundingClientRect();return s.textContent.includes('Could not load this cinematic')&&document.activeElement===s&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth`, nil)
				return value == true, err
			}, 10*time.Second); err != nil {
				t.Fatalf("cinematic error feedback: %v", err)
			}
			snapshot(t, driver, "cinematic-error-"+strconv.Itoa(scenario.width))
			if scenario.retry {
				if err := driver.ExecuteChromiumCommand("Network.setBlockedURLs", map[string]any{"urls": []string{}}); err != nil {
					t.Fatal(err)
				}
				if err := button(t, driver, "Retry").Click(); err != nil {
					t.Fatal(err)
				}
				waitMovie(t, driver, 1)
				advance(t, nil, 2*time.Second)
				canvas, err := driver.FindElement(selenium.ByCSSSelector, "canvas")
				if err != nil {
					t.Fatal(err)
				}
				if err := canvas.SendKeys(selenium.EscapeKey); err != nil {
					t.Fatal(err)
				}
			} else {
				if err := button(t, driver, "Skip cinematic").Click(); err != nil {
					t.Fatal(err)
				}
			}
			if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
				t.Fatal(err)
			}
			waitMenu(t, driver, nil, "cinematic-recovered-"+strconv.Itoa(scenario.width), 268)
		})
	}
}

func TestSkipDownloadingCinematic(t *testing.T) {
	driver := newBrowser(t, 390, 844)
	if err := driver.Get(siteURL(t) + "/experiments/red-alert"); err != nil {
		t.Fatal(err)
	}
	start := button(t, driver, "Start Red Alert")
	if err := driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Network.emulateNetworkConditions", map[string]any{"offline": false, "latency": 30000, "downloadThroughput": -1, "uploadThroughput": -1}); err != nil {
		t.Fatal(err)
	}
	if err := start.Click(); err != nil {
		t.Fatal(err)
	}
	skip := button(t, driver, "Skip cinematic")
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript(`const b=arguments[0],r=b.getBoundingClientRect(),p=document.querySelector('progress');return document.activeElement===b&&r.left>=0&&r.right<=innerWidth&&r.height>=44&&!p.hidden`, []interface{}{skip})
		return value == true, err
	}, 10*time.Second); err != nil {
		t.Fatalf("cinematic download controls: %v", err)
	}
	snapshot(t, driver, "cinematic-downloading-390")
	if err := skip.SendKeys(selenium.EscapeKey); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Network.emulateNetworkConditions", map[string]any{"offline": false, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1}); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	waitMenu(t, driver, nil, "cinematic-download-skipped", 268)
}

func TestCinematicNavigation(t *testing.T) {
	driver := newBrowser(t, 800, 600)
	base := siteURL(t)
	if err := driver.Get(base + "/experiments"); err != nil {
		t.Fatal(err)
	}
	link, err := driver.FindElement(selenium.ByCSSSelector, `a[href="/experiments/red-alert"]`)
	if err != nil {
		t.Fatal(err)
	}
	if err := link.Click(); err != nil {
		t.Fatal(err)
	}
	start := button(t, driver, "Start Red Alert")
	if err := driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Network.emulateNetworkConditions", map[string]any{"offline": false, "latency": 30000, "downloadThroughput": -1, "uploadThroughput": -1}); err != nil {
		t.Fatal(err)
	}
	if err := start.Click(); err != nil {
		t.Fatal(err)
	}
	button(t, driver, "Skip cinematic")
	if err := driver.Back(); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Network.emulateNetworkConditions", map[string]any{"offline": false, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1}); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		url, err := w.CurrentURL()
		return url == base+"/experiments", err
	}, 10*time.Second); err != nil {
		t.Fatal(err)
	}
	link, err = driver.FindElement(selenium.ByCSSSelector, `a[href="/experiments/red-alert"]`)
	if err != nil {
		t.Fatal(err)
	}
	if err := link.Click(); err != nil {
		t.Fatal(err)
	}
	button(t, driver, "Start Red Alert") // A second engine can start after the pending one shuts down.
}
