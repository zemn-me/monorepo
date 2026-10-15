package testing_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

// The game draws its controls on a canvas. Drive real input and inspect the
// rendered pixels and the engine's browser console rather than adding a game API.
func TestFreewareSkirmish(t *testing.T)         { playFreeware(t, "play") }
func TestGameDownloadFailure(t *testing.T)      { playFreeware(t, "error") }
func TestGameDownloadFailurePhone(t *testing.T) { playFreeware(t, "error-phone") }

func TestReactNavigation(t *testing.T) { playFreeware(t, "navigate") }

func TestWindowExit(t *testing.T) { playFreeware(t, "back") }

func TestDirectVisitExit(t *testing.T) { playFreeware(t, "direct") }

func playFreeware(t *testing.T, mode string) {
	quit := mode == "back" || mode == "direct"

	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{"pageLoadStrategy": "eager", "goog:loggingPrefs": map[string]string{"browser": "ALL"}}, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1280,1100")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	var messages strings.Builder
	readGameLog := func() (string, error) {
		entries, err := driver.Log(log.Browser)
		for _, entry := range entries {
			if strings.Contains(entry.Message, "Minified React error #418") || strings.Contains(entry.Message, "Hydration failed") {
				t.Errorf("React hydration failed: %s", entry.Message)
			}
			if (strings.Contains(entry.Message, "skirmish.rml opened") || strings.Contains(entry.Message, "Finished unit generation")) && entry.Level != log.Info {
				t.Errorf("routine game diagnostic has level %s, want INFO: %s", entry.Level, entry.Message)
			}
			messages.WriteString(entry.Message)
			messages.WriteByte('\n')
		}
		return messages.String(), err
	}

	var clock *seleniumutil.VirtualClock
	defer func() {
		if clock == nil {
			return
		}
		if shot, err := driver.Screenshot(); err == nil {
			dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
			if dir != "" {
				_ = os.WriteFile(filepath.Join(dir, t.Name()+".png"), shot, 0644)
			}
		}
		if t.Failed() {
			text, _ := readGameLog()
			t.Log(text)
		}
	}()
	width, height := 800, 600
	if mode == "error-phone" {
		width, height = 390, 844
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": width, "height": height, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	base := "http://localhost:" + ports.Site
	if mode == "back" {
		// A real previous document must survive quitting, rather than a fixed redirect.
		if err := driver.Get(base + "/experiments?from=tiberian-sun-test"); err != nil {
			t.Fatal(err)
		}
	}
	clock, err = seleniumutil.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	advance := func(duration time.Duration) {
		t.Helper()
		if err := clock.Advance(duration); err != nil {
			t.Fatal(err)
		}
	}
	wait := func(condition selenium.Condition, timeout time.Duration, intervals ...time.Duration) error {
		step := 100 * time.Millisecond
		if len(intervals) > 0 {
			step = intervals[0]
		}
		for elapsed := time.Duration(0); ; elapsed += step {
			ready, err := condition(driver)
			if err != nil || ready {
				return err
			}
			if elapsed >= timeout {
				return fmt.Errorf("condition not met after %s simulated time", timeout)
			}
			advance(step)
		}
	}

	if strings.HasPrefix(mode, "error") {
		if err := driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
			t.Fatal(err)
		}
		if err := driver.ExecuteChromiumCommand("Network.setBlockedURLs", map[string]any{"urls": []string{"*.gz"}}); err != nil {
			t.Fatal(err)
		}
	}
	var documentOrigin interface{}
	if mode == "navigate" {
		if err := driver.Get(base + "/"); err != nil {
			t.Fatal(err)
		}
		if err := driver.Get(base + "/experiments?from=react-game-test"); err != nil {
			t.Fatal(err)
		}
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			elements, err := w.FindElements(selenium.ByCSSSelector, "button[aria-label='Go back']")
			return len(elements) > 0, err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		documentOrigin, _ = driver.ExecuteScript("return performance.timeOrigin", nil)
		link, err := driver.FindElement(selenium.ByCSSSelector, "a[href='/experiments/tiberian-sun']")
		if err != nil {
			t.Fatal(err)
		}
		if err := link.Click(); err != nil {
			t.Fatal(err)
		}
	} else if err := driver.Get(base + "/experiments/tiberian-sun"); err != nil {
		t.Fatal(err)
	}
	if strings.HasPrefix(mode, "error") {
		// Fail the actual download at the network layer; no app state is seeded.
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			status, err := w.FindElement(selenium.ByCSSSelector, "[role='status']")
			if err != nil {
				return false, nil
			}
			text, _ := status.Text()
			valid, err := w.ExecuteScript(`const s=arguments[0],r=s.getBoundingClientRect();return document.activeElement===s&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth`, []interface{}{status})
			return strings.Contains(text, "Could not start the game") && valid == true, err
		}, 30*time.Second); err != nil {
			t.Fatalf("download failure is not visible and focused at width %d: %v", width, err)
		}
		text, _ := readGameLog()
		if strings.Contains(text, "Game Init Completed.") {
			t.Fatal("engine started after its game download failed")
		}
		return
	}
	if buttons, err := driver.FindElements(selenium.ByCSSSelector, "button#launch"); err != nil || len(buttons) != 0 {
		t.Fatalf("game should start on navigation without a launch button: %v", err)
	}
	if err := wait(func(w selenium.WebDriver) (bool, error) {
		el, err := w.FindElement(selenium.ByCSSSelector, "[role=status]")
		if err != nil {
			return false, nil
		}
		raw, _ := w.ExecuteScript("return arguments[0].textContent", []interface{}{el})
		text, _ := raw.(string)
		if strings.Contains(text, "Could not") || strings.Contains(text, "stopped") {
			return false, fmt.Errorf("startup: %s", text)
		}
		return strings.Contains(text, "Game running"), nil
	}, 120*time.Second); err != nil {
		t.Fatal(err)
	}

	if mode == "direct" {
		// Model opening a link in a fresh tab, with no earlier document to return to.
		if err := driver.ExecuteChromiumCommand("Page.resetNavigationHistory", map[string]any{}); err != nil {
			t.Fatal(err)
		}
	}
	canvas, err := driver.FindElement(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
	if err != nil {
		t.Fatal(err)
	}
	snapshot := func() image.Image {
		t.Helper()
		data, err := driver.Screenshot()
		if err != nil {
			t.Fatal(err)
		}
		frame, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatal(err)
		}
		return frame
	}
	waitPixels := func(label string, rect image.Rectangle, predicate func(uint32, uint32, uint32) bool, minimum int) {
		t.Helper()
		var count int

		err := wait(func(selenium.WebDriver) (bool, error) {
			frame := snapshot()
			count = 0
			for y := rect.Min.Y; y < rect.Max.Y; y++ {
				for x := rect.Min.X; x < rect.Max.X; x++ {
					px := frame.Bounds().Min.X + x*frame.Bounds().Dx()/800
					py := frame.Bounds().Min.Y + y*frame.Bounds().Dy()/600
					red, green, blue, _ := frame.At(px, py).RGBA()
					if predicate(red>>8, green>>8, blue>>8) {
						count++
					}
				}
			}
			return count >= minimum, nil
		}, 45*time.Second, 300*time.Millisecond)
		if err != nil {
			t.Fatalf("%s: %d matching pixels: %v", label, count, err)
		}
	}
	screenPoint := func(x, y int) (int, int) {
		t.Helper()
		rect, err := driver.ExecuteScript("const r=arguments[0].getBoundingClientRect(); return [r.left,r.top,r.width,r.height]", []interface{}{canvas})
		if err != nil {
			t.Fatal(err)
		}
		box := rect.([]interface{})
		px := int(box[0].(float64) + float64(x)*box[2].(float64)/800)
		py := int(box[1].(float64) + float64(y)*box[3].(float64)/600)
		return px, py
	}
	dispatch := func(px, py int, kind string, buttons int) {
		t.Helper()
		if err := driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", map[string]any{"type": kind, "x": px, "y": py, "button": "left", "buttons": buttons, "clickCount": 1}); err != nil {
			t.Fatal(err)
		}
	}
	pointer := func(x, y int, kind string, buttons int) {
		t.Helper()
		px, py := screenPoint(x, y)
		dispatch(px, py, kind, buttons)
	}
	mouse := func(x, y int, click bool) {
		t.Helper()
		// Exit navigates on press; resolve the canvas before either half of the click.
		px, py := screenPoint(x, y)
		dispatch(px, py, "mouseMoved", 0)
		if click {
			dispatch(px, py, "mousePressed", 1)
			advance(80 * time.Millisecond)
			dispatch(px, py, "mouseReleased", 0)
		}
	}
	click := func(x, y int) { t.Helper(); mouse(x, y, true) }
	colored := func(r, g, b uint32) bool { return r > 35 || g > 35 || b > 35 }
	cyan := func(r, g, b uint32) bool { return g > 100 && b > 100 && g > r+30 && b > r+30 }
	green := func(r, g, b uint32) bool { return g > 100 && g > b+50 && g > r }
	waitPixels("game selector rendered", image.Rect(100, 150, 360, 470), colored, 15000)
	// Artwork appears before the selector starts accepting input. With time
	// paused, wait for its hover response rather than relying on elapsed wall time.
	white := func(r, g, b uint32) bool { return r > 200 && g > 200 && b > 200 }
	mouse(120, 110, false)
	waitPixels("interactive game selector", image.Rect(105, 102, 140, 120), white, 30)
	if mode == "navigate" {
		origin, _ := driver.ExecuteScript("return performance.timeOrigin", nil)
		if origin != documentOrigin {
			t.Fatal("game navigation replaced the React document")
		}
		if err := driver.Back(); err != nil {
			t.Fatal(err)
		}
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			current, err := w.CurrentURL()
			if err != nil {
				return false, err
			}
			text, err := readGameLog()
			canvases, _ := w.FindElements(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
			overflow, _ := w.ExecuteScript("return document.body.style.overflow", nil)
			return current == base+"/experiments?from=react-game-test" && len(canvases) == 0 && overflow == "" && strings.Contains(text, "Tiberian Sun runtime stopped"), err
		}, 30*time.Second); err != nil {
			t.Fatalf("React unmount did not stop the engine and restore the page: %v", err)
		}
		link, err := driver.FindElement(selenium.ByCSSSelector, "a[href='/experiments/tiberian-sun']")
		if err != nil {
			t.Fatal(err)
		}
		if err := link.Click(); err != nil {
			t.Fatal(err)
		}
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			var err error
			canvas, err = w.FindElement(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
			return canvas != nil, err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		mouse(120, 110, false)
		waitPixels("interactive selector after remount", image.Rect(105, 102, 140, 120), white, 30)
		text, _ := readGameLog()
		if strings.Count(text, "Game Init Completed.") != 2 {
			t.Fatal("game did not start exactly once per React mount")
		}
		origin, _ = driver.ExecuteScript("return performance.timeOrigin", nil)
		if origin != documentOrigin {
			t.Fatal("game remount replaced the React document")
		}
		click(120, 110)
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			url, err := w.CurrentURL()
			return url == base+"/experiments?from=react-game-test", err
		}, 30*time.Second); err != nil {
			t.Fatal(err)
		}
		return
	}
	if quit {
		click(120, 110) // Exit from the original game selector.
		if err := wait(func(w selenium.WebDriver) (bool, error) {
			current, err := w.CurrentURL()
			destination := base + "/experiments"
			if mode == "back" {
				destination += "?from=tiberian-sun-test"
			}
			return current == destination, err
		}, 30*time.Second); err != nil {
			t.Fatalf("quitting did not return to the previous page: %v", err)
		}

		return
	}
	click(240, 300) // Original Tiberian Sun disc.
	waitPixels("main menu ready", image.Rect(320, 240, 480, 450), cyan, 150)
	mouse(400, 408, false)
	waitPixels("interactive Skirmish highlight", image.Rect(366, 400, 436, 418), white, 40)
	click(400, 408) // Skirmish.
	waitPixels("skirmish setup ready", image.Rect(548, 458, 568, 472), green, 15)
	if err := wait(func(w selenium.WebDriver) (bool, error) {
		text, err := readGameLog()
		return strings.Contains(text, "skirmish.rml opened"), err
	}, 30*time.Second); err != nil {
		t.Fatalf("skirmish controls did not finish opening: %v", err)
	}
	click(558, 465) // Start the default Grand Canyon skirmish against an AI.
	if err := wait(func(w selenium.WebDriver) (bool, error) {
		text, err := readGameLog()
		return strings.Contains(text, "Finished unit generation"), err
	}, 60*time.Second); err != nil {
		t.Fatalf("scenario did not generate units: %v", err)
	}
	waitPixels("terrain and units rendered", image.Rect(150, 140, 500, 350), colored, 15000)
	// Spawn positions and MCV facing vary with the scenario seed. Box-select
	// the starting army so the deployment check does not rely on a sprite pixel.
	pointer(120, 100, "mouseMoved", 0)
	pointer(120, 100, "mousePressed", 1)
	for step := 1; step <= 10; step++ {
		pointer(120+step*39, 100+step*26, "mouseMoved", 1)
		advance(25 * time.Millisecond)
	}
	pointer(510, 360, "mouseReleased", 0)
	if err := canvas.SendKeys("d"); err != nil {
		t.Fatal(err)
	}
	waitPixels("construction yard unlocks power plant", image.Rect(656, 178, 719, 220), colored, 1100)
	// Run ten seconds of the actual simulation without waiting ten wall seconds.
	// Advancing at the browser layer covers native engine time and async waits.
	beforeAdvance, err := driver.ExecuteScript("return performance.now()", nil)
	if err != nil {
		t.Fatal(err)
	}

	before := snapshot()
	advancedAt := time.Now()
	advance(10 * time.Second)
	t.Logf("advanced ten seconds of game time in %s", time.Since(advancedAt))
	afterAdvance, err := driver.ExecuteScript("return performance.now()", nil)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(afterAdvance.(float64)-beforeAdvance.(float64)-10000) > 1 {
		t.Fatalf("game clock did not advance by ten virtual seconds")
	}
	if err := wait(func(selenium.WebDriver) (bool, error) {
		frame := snapshot()
		changed := 0
		for y := 140; y < 400; y++ {
			for x := 150; x < 500; x++ {
				if frame.At(x, y) != before.At(x, y) {
					changed++
				}
			}
		}
		return changed > 150, nil
	}, 15*time.Second, time.Second); err != nil {
		t.Fatalf("simulation stopped animating: %v", err)
	}
	status, _ := driver.FindElement(selenium.ByCSSSelector, "[role=status]")
	raw, _ := driver.ExecuteScript("return arguments[0].textContent", []interface{}{status})
	text, _ := raw.(string)
	// The game occupies the viewport and the surrounding page stays out of play.
	layout, err := driver.ExecuteScript(`const c=arguments[0], r=c.getBoundingClientRect(); return getComputedStyle(document.querySelector('main')).display === 'none' && r.x === 0 && r.y === 0 && r.width === innerWidth && r.height === innerHeight`, []interface{}{canvas})
	if err != nil || layout != true {
		t.Fatalf("game does not fill the window: %v %v", layout, err)
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1440, "height": 900, "deviceScaleFactor": 2, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := wait(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript("return arguments[0].width === 1440 && arguments[0].height === 900", []interface{}{canvas})
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatalf("framebuffer did not adapt to larger window: %v", err)
	}
	// A genuine mode change updates the terrain and sidebar surfaces too.
	if err := wait(func(w selenium.WebDriver) (bool, error) {
		text, err := readGameLog()
		return strings.Contains(text, "VisibleRect: 1440x900") && strings.Contains(text, "Mode change complete."), err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := wait(func(selenium.WebDriver) (bool, error) {
		frame := snapshot()
		count := 0
		for y := 178; y < 220; y++ {
			for x := 1296; x < 1359; x++ {
				r, g, b, _ := frame.At(x*frame.Bounds().Dx()/1440, y*frame.Bounds().Dy()/900).RGBA()
				if colored(r>>8, g>>8, b>>8) {
					count++
				}
			}
		}
		return count > 1100, nil
	}, 15*time.Second, 300*time.Millisecond); err != nil {
		t.Fatalf("sidebar did not redraw at the larger resolution: %v", err)
	}
	if !strings.Contains(text, "Game running") {
		t.Fatalf("runtime failed: %s", text)
	}
}
