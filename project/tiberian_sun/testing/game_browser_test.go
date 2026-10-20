package testing_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
	"image"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The engine draws bitmap controls. Keep browser mechanics here; test cases
// state their navigation, input, and expected visible results together.
type freewareBrowser struct {
	t                     *testing.T
	driver                *seleniumutil.Driver
	clock                 *seleniumutil.VirtualClock
	base                  string
	canvas                selenium.WebElement
	messages              strings.Builder
	menuWidth, menuHeight int
	scaledMenus           bool
}

func newFreewareBrowser(t *testing.T) *freewareBrowser {
	t.Helper()
	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	g := &freewareBrowser{t: t, driver: newGameBrowser(t, "--window-size=1280,1100"), base: "http://localhost:" + ports.Site, menuWidth: 800, menuHeight: 600}
	t.Cleanup(func() { g.driver.Close() })
	t.Cleanup(func() {
		if shot, err := g.driver.Screenshot(); err == nil {
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				_ = os.WriteFile(filepath.Join(dir, strings.ReplaceAll(t.Name(), "/", "-")+".png"), shot, 0644)
			}
		}
		if t.Failed() {
			text, _ := g.readGameLog()
			t.Log(text)
		}
	})
	if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	return g
}

func (g *freewareBrowser) installClock() {
	g.t.Helper()
	var err error
	g.clock, err = seleniumutil.NewVirtualClock(g.driver)
	if err != nil {
		g.t.Fatal(err)
	}
}

func (g *freewareBrowser) navigate() {
	g.t.Helper()
	g.installClock()
	if err := g.driver.Get(g.base + "/experiments/tiberian-sun"); err != nil {
		g.t.Fatal(err)
	}
}

func (g *freewareBrowser) readGameLog() (string, error) {
	entries, err := g.driver.Log(log.Browser)
	for _, entry := range entries {
		if strings.Contains(entry.Message, "Minified React error #418") || strings.Contains(entry.Message, "Hydration failed") {
			g.t.Errorf("React hydration failed: %s", entry.Message)
		}
		if (strings.Contains(entry.Message, "skirmish.rml opened") || strings.Contains(entry.Message, "Finished unit generation")) && entry.Level != log.Info {
			g.t.Errorf("routine game diagnostic has level %s, want INFO: %s", entry.Level, entry.Message)
		}
		g.messages.WriteString(entry.Message)
		g.messages.WriteByte('\n')
	}
	return g.messages.String(), err
}

func (g *freewareBrowser) advance(duration time.Duration) {
	g.t.Helper()
	// Bound long advances while keeping short input gestures atomic:
	// Exit may restore an older document without the injected clock.
	// A long tick can render hundreds of frames before returning control.
	for duration > 0 {
		step := min(duration, 100*time.Millisecond)
		if err := g.clock.Advance(step); err != nil {
			g.t.Fatal(err)
		}
		duration -= step
	}
}

func (g *freewareBrowser) wait(condition selenium.Condition, timeout time.Duration, intervals ...time.Duration) error {
	step := 100 * time.Millisecond
	if len(intervals) > 0 {
		step = intervals[0]
	}
	for elapsed := time.Duration(0); ; elapsed += step {
		ready, err := condition(g.driver)
		if err != nil || ready {
			return err
		}
		if elapsed >= timeout {
			return fmt.Errorf("condition not met after %s simulated time", timeout)
		}
		g.advance(step)
	}
}

func (g *freewareBrowser) snapshot() image.Image {
	g.t.Helper()
	data, err := g.driver.Screenshot()
	if err != nil {
		g.t.Fatal(err)
	}
	frame, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		g.t.Fatal(err)
	}
	return frame
}

func (g *freewareBrowser) menuPoint(x, y int) (float64, float64) {
	scale := math.Min(float64(g.menuWidth)/800, float64(g.menuHeight)/600)
	return (float64(g.menuWidth)-800*scale)/2 + float64(x)*scale,
		(float64(g.menuHeight)-600*scale)/2 + float64(y)*scale
}

func (g *freewareBrowser) waitPixels(label string, rect image.Rectangle, predicate func(uint32, uint32, uint32) bool, minimum int, before ...func()) {
	g.t.Helper()
	var count int

	err := g.wait(func(selenium.WebDriver) (bool, error) {
		for _, prepare := range before {
			prepare()
		}
		frame := g.snapshot()
		count = 0
		for y := rect.Min.Y; y < rect.Max.Y; y++ {
			for x := rect.Min.X; x < rect.Max.X; x++ {
				mx, my := g.menuPoint(x, y)
				px := frame.Bounds().Min.X + int(mx*float64(frame.Bounds().Dx())/float64(g.menuWidth))
				py := frame.Bounds().Min.Y + int(my*float64(frame.Bounds().Dy())/float64(g.menuHeight))
				red, green, blue, _ := frame.At(px, py).RGBA()
				if predicate(red>>8, green>>8, blue>>8) {
					count++
				}
			}
		}
		return count >= minimum, nil
	}, 45*time.Second, 300*time.Millisecond)
	if err != nil {
		g.t.Fatalf("%s: %d matching pixels: %v", label, count, err)
	}
}

func (g *freewareBrowser) screenPoint(x, y int) (int, int) {
	g.t.Helper()
	rect, err := g.driver.ExecuteScript("const r=arguments[0].getBoundingClientRect(); return [r.left,r.top,r.width,r.height]", []interface{}{g.canvas})
	if err != nil {
		g.t.Fatal(err)
	}
	box := rect.([]interface{})
	if g.scaledMenus {
		// Rml also scales its 800x600 layout inside gameplay-sized canvases.
		mx, my := g.menuPoint(x, y)
		return int(mx), int(my)
	}
	px := int(box[0].(float64) + float64(x)*box[2].(float64)/800)
	py := int(box[1].(float64) + float64(y)*box[3].(float64)/600)
	return px, py
}

func (g *freewareBrowser) dispatch(px, py int, kind string, buttons int) {
	g.t.Helper()
	if err := g.driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", map[string]any{"type": kind, "x": px, "y": py, "button": "left", "buttons": buttons, "clickCount": 1}); err != nil {
		g.t.Fatal(err)
	}
}

func (g *freewareBrowser) pointer(x, y int, kind string, buttons int) {
	g.t.Helper()
	px, py := g.screenPoint(x, y)
	g.dispatch(px, py, kind, buttons)
}

func (g *freewareBrowser) mouse(x, y int, click bool) {
	g.t.Helper()
	// Exit navigates on press; resolve the canvas before either half of the click.
	px, py := g.screenPoint(x, y)
	g.dispatch(px, py, "mouseMoved", 0)
	if click {
		// The native menu consumes motion at an Asyncify yield; let it
		// update its hovered item before the press is queued.
		g.advance(50 * time.Millisecond)
		g.dispatch(px, py, "mousePressed", 1)
		g.advance(80 * time.Millisecond)
		g.dispatch(px, py, "mouseReleased", 0)
	}
}

func (g *freewareBrowser) click(x, y int) { g.t.Helper(); g.mouse(x, y, true) }

func colored(r, g, b uint32) bool { return r > 35 || g > 35 || b > 35 }
func cyan(r, g, b uint32) bool    { return g > 100 && b > 100 && g > r+30 && b > r+30 }
func green(r, g, b uint32) bool   { return g > 100 && g > b+50 && g > r }
func white(r, g, b uint32) bool   { return r > 200 && g > 200 && b > 200 }

func (g *freewareBrowser) waitRunning() {
	g.t.Helper()
	if buttons, err := g.driver.FindElements(selenium.ByCSSSelector, "button#launch"); err != nil || len(buttons) != 0 {
		g.t.Fatalf("game should start on navigation without a launch button: %v", err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
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
		g.t.Fatal(err)
	}
	var err error
	g.canvas, err = g.driver.FindElement(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
	if err != nil {
		g.t.Fatal(err)
	}
}

func (g *freewareBrowser) waitSelector() {
	g.t.Helper()
	g.waitPixels("game selector rendered", image.Rect(100, 150, 360, 470), colored, 15000)
	// Artwork appears before the selector starts accepting input. With time
	// paused, wait for its hover response rather than relying on elapsed wall time.
	g.mouse(120, 110, false)
	g.waitPixels("interactive game selector", image.Rect(105, 102, 140, 120), white, 30)
}

func (g *freewareBrowser) startSkirmish() {
	g.t.Helper()
	g.click(240, 300) // Original Tiberian Sun disc.
	g.waitPixels("main menu ready", image.Rect(320, 240, 480, 450), cyan, 150)
	g.mouse(400, 408, false)
	g.waitPixels("interactive Skirmish highlight", image.Rect(366, 400, 436, 418), white, 40)
	g.click(400, 408) // Skirmish.
	g.waitPixels("skirmish setup ready", image.Rect(548, 458, 568, 472), green, 15)
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		text, err := g.readGameLog()
		return strings.Contains(text, "skirmish.rml opened"), err
	}, 30*time.Second); err != nil {
		g.t.Fatalf("skirmish controls did not finish opening: %v", err)
	}
	g.click(558, 465) // Start the default Grand Canyon skirmish against an AI.
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		text, err := g.readGameLog()
		return strings.Contains(text, "Finished unit generation"), err
	}, 60*time.Second); err != nil {
		g.t.Fatalf("scenario did not generate units: %v", err)
	}
}
