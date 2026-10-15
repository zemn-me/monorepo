package testing_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

// The game draws its controls on a canvas. Drive real input and inspect the
// rendered pixels and the engine's visible log rather than adding a game API.
func TestFreewareSkirmish(t *testing.T) { playFreeware(t, false) }
func TestWindowExit(t *testing.T)       { playFreeware(t, true) }

func playFreeware(t *testing.T, quit bool) {
	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	driver, err := seleniumutil.NewWithChromeArguments("--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required", "--window-size=1280,1100")
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	defer func() {
		if shot, err := driver.Screenshot(); err == nil {
			dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
			if dir != "" {
				_ = os.WriteFile(filepath.Join(dir, t.Name()+".png"), shot, 0644)
			}
		}
		if t.Failed() {
			if el, err := driver.FindElement(selenium.ByCSSSelector, "#log"); err == nil {
				text, _ := driver.ExecuteScript("return arguments[0].textContent", []interface{}{el})
				t.Log(text)
			}
		}
	}()
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := driver.Get("http://localhost:" + ports.Site + "/experiments/tiberian-sun"); err != nil {
		t.Fatal(err)
	}
	start, err := driver.FindElement(selenium.ByCSSSelector, "button#launch")
	if err != nil {
		t.Fatal(err)
	}
	if enabled, _ := start.IsEnabled(); !enabled {
		t.Fatal("freeware game requires no upload before starting")
	}
	details, err := driver.FindElement(selenium.ByCSSSelector, "details > summary")
	if err != nil {
		t.Fatal(err)
	}
	if err := details.Click(); err != nil {
		t.Fatal(err)
	}
	if err := start.Click(); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		el, err := w.FindElement(selenium.ByCSSSelector, "[role=status]")
		if err != nil {
			return false, err
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
	canvas, err := driver.FindElement(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
	if err != nil {
		t.Fatal(err)
	}
	snapshot := func() image.Image {
		t.Helper()
		data, err := canvas.Screenshot(true)
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
		err := driver.WaitWithTimeoutAndInterval(func(selenium.WebDriver) (bool, error) {
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
	pointer := func(x, y int, kind string, buttons int) {
		t.Helper()
		rect, err := driver.ExecuteScript("const r=arguments[0].getBoundingClientRect(); return [r.left,r.top,r.width,r.height]", []interface{}{canvas})
		if err != nil {
			t.Fatal(err)
		}
		box := rect.([]interface{})
		px := int(box[0].(float64) + float64(x)*box[2].(float64)/800)
		py := int(box[1].(float64) + float64(y)*box[3].(float64)/600)
		if err := driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", map[string]any{"type": kind, "x": px, "y": py, "button": "left", "buttons": buttons, "clickCount": 1}); err != nil {
			t.Fatal(err)
		}
	}
	mouse := func(x, y int, click bool) {
		pointer(x, y, "mouseMoved", 0)
		if click {
			pointer(x, y, "mousePressed", 1)
			time.Sleep(80 * time.Millisecond)
			pointer(x, y, "mouseReleased", 0)
		}
	}
	click := func(x, y int) { t.Helper(); mouse(x, y, true) }
	colored := func(r, g, b uint32) bool { return r > 35 || g > 35 || b > 35 }
	cyan := func(r, g, b uint32) bool { return g > 100 && b > 100 && g > r+30 && b > r+30 }
	green := func(r, g, b uint32) bool { return g > 100 && g > b+50 && g > r }
	waitPixels("game selector rendered", image.Rect(100, 150, 360, 470), colored, 15000)
	if quit {
		mouse(120, 110, false)
		highlight := func(r, g, b uint32) bool { return r > 200 && g > 200 && b > 200 }
		waitPixels("interactive Exit highlight", image.Rect(105, 102, 140, 120), highlight, 30)
		click(120, 110) // Exit from the original game selector.
		if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
			value, err := w.ExecuteScript(`return document.querySelector('#status').textContent === 'Game closed.' && getComputedStyle(document.querySelector('main')).display !== 'none' && document.querySelector('#game-view').hidden && !document.querySelector('#launch').disabled && document.activeElement.id === 'launch'`, nil)
			return value == true, err
		}, 30*time.Second); err != nil {
			t.Fatalf("quitting did not restore the page: %v", err)
		}
		if err := start.Click(); err != nil {
			t.Fatal(err)
		}
		if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
			value, err := w.ExecuteScript(`return document.body.dataset.state === 'running' && !document.querySelector('#game-view').hidden`, nil)
			return value == true, err
		}, 120*time.Second); err != nil {
			t.Fatalf("restarting failed: %v", err)
		}
		return
	}
	click(240, 300) // Original Tiberian Sun disc.
	waitPixels("main menu ready", image.Rect(320, 240, 480, 450), cyan, 150)
	mouse(400, 408, false)
	white := func(r, g, b uint32) bool { return r > 200 && g > 200 && b > 200 }
	waitPixels("interactive Skirmish highlight", image.Rect(366, 400, 436, 418), white, 40)
	click(400, 408) // Skirmish.
	waitPixels("skirmish setup ready", image.Rect(548, 458, 568, 472), green, 15)
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		el, err := w.FindElement(selenium.ByCSSSelector, "#log")
		if err != nil {
			return false, err
		}
		raw, err := w.ExecuteScript("return arguments[0].textContent", []interface{}{el})
		text, _ := raw.(string)
		return strings.Contains(text, "skirmish.rml opened"), err
	}, 30*time.Second); err != nil {
		t.Fatalf("skirmish controls did not finish opening: %v", err)
	}
	click(558, 465) // Start the default Grand Canyon skirmish against an AI.
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		el, err := w.FindElement(selenium.ByCSSSelector, "#log")
		if err != nil {
			return false, err
		}
		raw, err := w.ExecuteScript("return arguments[0].textContent", []interface{}{el})
		text, _ := raw.(string)
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
		time.Sleep(25 * time.Millisecond)
	}
	pointer(510, 360, "mouseReleased", 0)
	if err := canvas.SendKeys("d"); err != nil {
		t.Fatal(err)
	}
	waitPixels("construction yard unlocks power plant", image.Rect(656, 178, 719, 220), colored, 1100)
	// Keep the simulation running beyond initial rendering and input handling.
	before := snapshot()
	if err := driver.WaitWithTimeoutAndInterval(func(selenium.WebDriver) (bool, error) {
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
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript("return arguments[0].width === 1440 && arguments[0].height === 900", []interface{}{canvas})
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatalf("framebuffer did not adapt to larger window: %v", err)
	}
	// A genuine mode change updates the terrain and sidebar surfaces too.
	if err := driver.WaitWithTimeout(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript("return document.querySelector('#log').textContent.includes('VisibleRect: 1440x900') && document.querySelector('#log').textContent.includes('Mode change complete.')", nil)
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeoutAndInterval(func(selenium.WebDriver) (bool, error) {
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
