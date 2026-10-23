package testing_test

import (
	"fmt"
	"github.com/tebeka/selenium"
	"image"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestFreewareSkirmish(t *testing.T) {
	g := newFreewareBrowser(t)
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	g.startSkirmish()
	g.waitPixels("terrain and units rendered", image.Rect(150, 140, 500, 350), colored, 15000)
	g.deployStartingArmy()
	// Run ten seconds of the actual simulation without waiting ten wall seconds.
	// Advancing at the browser layer covers native engine time and async waits.
	beforeAdvance, err := g.driver.ExecuteScript("return performance.now()", nil)
	if err != nil {
		t.Fatal(err)
	}

	before := g.snapshot()
	advancedAt := time.Now()
	g.advance(10 * time.Second)
	t.Logf("advanced ten seconds of game time in %s", time.Since(advancedAt))
	afterAdvance, err := g.driver.ExecuteScript("return performance.now()", nil)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(afterAdvance.(float64)-beforeAdvance.(float64)-10000) > 1 {
		t.Fatalf("game clock did not advance by ten virtual seconds")
	}
	if err := g.wait(func(selenium.WebDriver) (bool, error) {
		frame := g.snapshot()
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
	status, _ := g.driver.FindElement(selenium.ByCSSSelector, "[role=status]")
	raw, _ := g.driver.ExecuteScript("return arguments[0].textContent", []interface{}{status})
	text, _ := raw.(string)
	// The game occupies the viewport and the surrounding page stays out of play.
	layout, err := g.driver.ExecuteScript(`const c=arguments[0], r=c.getBoundingClientRect(); return getComputedStyle(document.querySelector('main')).display === 'none' && r.x === 0 && r.y === 0 && r.width === innerWidth && r.height === innerHeight`, []interface{}{g.canvas})
	if err != nil || layout != true {
		t.Fatalf("game does not fill the window: %v %v", layout, err)
	}
	if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1440, "height": 900, "screenWidth": 1440, "screenHeight": 900, "deviceScaleFactor": 2, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript("return arguments[0].width === 960 && arguments[0].height === 600", []interface{}{g.canvas})
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatalf("framebuffer did not adapt to larger window: %v", err)
	}
	// A genuine mode change updates the terrain and sidebar surfaces too.
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		text, err := g.readGameLog()
		return strings.Contains(text, "VisibleRect: 960x600") && strings.Contains(text, "Mode change complete."), err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(selenium.WebDriver) (bool, error) {
		frame := g.snapshot()
		count := 0
		for y := 178; y < 220; y++ {
			for x := 816; x < 879; x++ {
				r, g, b, _ := frame.At(x*frame.Bounds().Dx()/960, y*frame.Bounds().Dy()/600).RGBA()
				if colored(r>>8, g>>8, b>>8) {
					count++
				}
			}
		}
		return count > 1100, nil
	}, 15*time.Second, 300*time.Millisecond); err != nil {
		t.Fatalf("sidebar did not redraw at the larger resolution: %v", err)
	}
	// The same full-screen view survives resolution and density changes, while
	// a smaller window on that display shows less terrain at the same scale.
	for _, size := range []struct {
		name                                                          string
		windowWidth, windowHeight, screenWidth, screenHeight, density int
		frameWidth, frameHeight                                       int
	}{
		{"high resolution", 2880, 1800, 2880, 1800, 1, 960, 600},
		{"high density", 2880, 1800, 2880, 1800, 2, 960, 600},
		{"smaller window", 2400, 1800, 2880, 1800, 1, 800, 600},
		{"ultrawide", 3440, 1440, 3440, 1440, 1, 1433, 600},
		{"small display", 640, 480, 640, 480, 1, 800, 600},
	} {
		t.Run(size.name, func(t *testing.T) {
			if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{
				"width": size.windowWidth, "height": size.windowHeight,
				"screenWidth": size.screenWidth, "screenHeight": size.screenHeight,
				"deviceScaleFactor": size.density, "mobile": false,
			}); err != nil {
				t.Fatal(err)
			}
			if err := g.wait(func(w selenium.WebDriver) (bool, error) {
				value, err := w.ExecuteScript(`const [c,w,h]=arguments,r=c.getBoundingClientRect();
				return c.width===w && c.height===h && Math.abs(r.width/r.height-w/h)<0.001 &&
				Math.abs(r.x-(innerWidth-r.width)/2)<1 && Math.abs(r.y-(innerHeight-r.height)/2)<1`, []interface{}{g.canvas, size.frameWidth, size.frameHeight})
				return value == true, err
			}, 30*time.Second); err != nil {
				t.Fatalf("framebuffer did not adapt to display: %v", err)
			}
		})
	}
	if !strings.Contains(text, "Game running") {
		t.Fatalf("runtime failed: %s", text)
	}
}

func TestGameDownloadFailure(t *testing.T) {
	for _, viewport := range []struct {
		name          string
		width, height int
	}{{"desktop", 800, 600}, {"phone", 390, 844}} {
		t.Run(viewport.name, func(t *testing.T) {
			g := newFreewareBrowser(t)
			if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": viewport.width, "height": viewport.height, "deviceScaleFactor": 1, "mobile": false}); err != nil {
				t.Fatal(err)
			}
			if err := g.driver.ExecuteChromiumCommand("Network.enable", map[string]any{}); err != nil {
				t.Fatal(err)
			}
			if err := g.driver.ExecuteChromiumCommand("Network.setBlockedURLs", map[string]any{"urls": []string{"*.gz"}}); err != nil {
				t.Fatal(err)
			}
			g.navigate()
			// Fail the actual download at the network layer; no app state is seeded.
			if err := g.wait(func(w selenium.WebDriver) (bool, error) {
				status, err := w.FindElement(selenium.ByCSSSelector, "[role='status']")
				if err != nil {
					return false, nil
				}
				text, _ := status.Text()
				valid, err := w.ExecuteScript(`const s=arguments[0],r=s.getBoundingClientRect();return document.activeElement===s&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth`, []interface{}{status})
				return strings.Contains(text, "Could not start the game") && valid == true, err
			}, 30*time.Second); err != nil {
				t.Fatalf("download failure is not visible and focused at width %d: %v", viewport.width, err)
			}
			text, _ := g.readGameLog()
			if strings.Contains(text, "Game Init Completed.") {
				t.Fatal("engine started after its game download failed")
			}
		})
	}
}

func TestMenuContain(t *testing.T) {
	g := newFreewareBrowser(t)
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	g.scaledMenus = true
	// Resize while a menu is open, checking both width- and height-limited
	// layouts at high pixel density. Hover pixels prove hit testing follows.
	for _, size := range [][2]int{{1920, 1080}, {900, 1440}, {390, 844}, {1920, 1080}} {
		g.menuWidth, g.menuHeight = size[0], size[1]
		if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": g.menuWidth, "height": g.menuHeight, "screenWidth": g.menuWidth, "screenHeight": g.menuHeight, "deviceScaleFactor": 2, "mobile": false}); err != nil {
			t.Fatal(err)
		}
		if err := g.wait(func(w selenium.WebDriver) (bool, error) {
			value, err := w.ExecuteScript(`const c=arguments[0], r=c.getBoundingClientRect(), s=Math.min(innerWidth/800,innerHeight/600); return Math.abs(r.width-800*s)<1 && Math.abs(r.height-600*s)<1 && Math.abs(r.x-(innerWidth-r.width)/2)<1 && Math.abs(r.y-(innerHeight-r.height)/2)<1`, []interface{}{g.canvas})
			return value == true, err
		}, 30*time.Second); err != nil {
			layout, _ := g.driver.ExecuteScript("const c=arguments[0], r=c.getBoundingClientRect(); return JSON.stringify({width:c.width,height:c.height,rect:r.toJSON(),viewport:[innerWidth,innerHeight],aspect:c.style.getPropertyValue('--game-aspect')})", []interface{}{g.canvas})
			t.Fatalf("menu contain at %dx%d: %v; %v", g.menuWidth, g.menuHeight, err, layout)
		}
		minimum := 30
		if g.menuWidth < 800 {
			// Downsampling antialiases the thin highlight strokes on phones.
			minimum = 15
		}
		// CSS settles before SDL consumes its resize event. Keep moving the
		// pointer until the native highlight proves the new scale is ready.
		g.waitPixels("resized selector hover", image.Rect(105, 102, 140, 120), white, minimum, func() { g.mouse(120, 110, false) })
		if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
			shot, err := g.driver.Screenshot()
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("menu-%dx%d.png", g.menuWidth, g.menuHeight)), shot, 0644); err != nil {
				t.Fatal(err)
			}
		}
	}
	g.startSkirmish()
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript(`const c=arguments[0],r=c.getBoundingClientRect(); return c.width===1067 && c.height===600 && Math.abs(r.x)<1 && Math.abs(r.y)<1 && Math.abs(r.width-innerWidth)<1 && Math.abs(r.height-innerHeight)<1`, []interface{}{g.canvas})
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatalf("scaled menus did not transition to viewport-sized gameplay: %v", err)
	}
}

func TestReactNavigation(t *testing.T) {
	g := newFreewareBrowser(t)
	g.installClock()
	var documentOrigin interface{}
	if err := g.driver.Get(g.base + "/"); err != nil {
		t.Fatal(err)
	}
	if err := g.driver.Get(g.base + "/experiments?from=react-game-test"); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		elements, err := w.FindElements(selenium.ByCSSSelector, "button[aria-label='Go back']")
		return len(elements) > 0, err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	documentOrigin, _ = g.driver.ExecuteScript("return performance.timeOrigin", nil)
	link, err := g.driver.FindElement(selenium.ByCSSSelector, "a[href='/experiments/tiberian-sun']")
	if err != nil {
		t.Fatal(err)
	}
	if err := link.Click(); err != nil {
		t.Fatal(err)
	}
	g.waitRunning()
	g.waitSelector()
	origin, _ := g.driver.ExecuteScript("return performance.timeOrigin", nil)
	if origin != documentOrigin {
		t.Fatal("game navigation replaced the React document")
	}
	if err := g.driver.Back(); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		current, err := w.CurrentURL()
		if err != nil {
			return false, err
		}
		text, err := g.readGameLog()
		canvases, _ := w.FindElements(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
		overflow, _ := w.ExecuteScript("return document.body.style.overflow", nil)
		return current == g.base+"/experiments?from=react-game-test" && len(canvases) == 0 && overflow == "" && strings.Contains(text, "Tiberian Sun runtime stopped"), err
	}, 30*time.Second); err != nil {
		t.Fatalf("React unmount did not stop the engine and restore the page: %v", err)
	}
	link, err = g.driver.FindElement(selenium.ByCSSSelector, "a[href='/experiments/tiberian-sun']")
	if err != nil {
		t.Fatal(err)
	}
	if err := link.Click(); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		canvases, err := w.FindElements(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
		if err != nil || len(canvases) == 0 {
			return false, err
		}
		g.canvas = canvases[0]
		return true, nil
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	g.waitPixels("game selector rendered after remount", image.Rect(100, 150, 360, 470), colored, 15000)
	g.mouse(120, 110, false)
	g.waitPixels("interactive selector after remount", image.Rect(105, 102, 140, 120), white, 30)
	canvases, err := g.driver.FindElements(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
	if err != nil || len(canvases) != 1 {
		t.Fatalf("remounted game has %d canvases: %v", len(canvases), err)
	}
	origin, _ = g.driver.ExecuteScript("return performance.timeOrigin", nil)
	if origin != documentOrigin {
		t.Fatal("game remount replaced the React document")
	}
	g.click(120, 110)
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		url, err := w.CurrentURL()
		return url == g.base+"/experiments?from=react-game-test", err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
}

func TestWindowExit(t *testing.T) {
	g := newFreewareBrowser(t)
	if err := g.driver.Get(g.base + "/experiments?from=tiberian-sun-test"); err != nil {
		t.Fatal(err)
	}
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	g.click(120, 110) // Exit from the original game selector.
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		current, err := w.CurrentURL()
		return current == g.base+"/experiments?from=tiberian-sun-test", err
	}, 30*time.Second); err != nil {
		t.Fatalf("quitting did not return to the previous page: %v", err)
	}
}

func TestDirectVisitExit(t *testing.T) {
	g := newFreewareBrowser(t)
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	if err := g.driver.ExecuteChromiumCommand("Page.resetNavigationHistory", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	g.click(120, 110) // Exit from the original game selector.
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		current, err := w.CurrentURL()
		return current == g.base+"/experiments", err
	}, 30*time.Second); err != nil {
		t.Fatalf("quitting did not return to the previous page: %v", err)
	}
}

func TestPhoneGameplayScale(t *testing.T) {
	g := newFreewareBrowser(t)
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	g.startSkirmish()
	g.deployStartingArmy()
	// Keep gameplay centered on the same starting army after each mode change.
	for _, size := range []struct {
		name                                   string
		width, height, frameWidth, frameHeight int
	}{
		{"iphone-portrait", 390, 844, 360, 779},
		{"iphone-landscape", 844, 390, 675, 312},
		{"large-iphone-portrait", 430, 932, 360, 780},
		{"large-iphone-landscape", 932, 430, 746, 344},
	} {
		t.Run(size.name, func(t *testing.T) {
			if err := g.driver.ExecuteChromiumCommand("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": true, "maxTouchPoints": 5}); err != nil {
				t.Fatal(err)
			}
			if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": size.width, "height": size.height, "screenWidth": size.width, "screenHeight": size.height, "deviceScaleFactor": 3, "mobile": true}); err != nil {
				t.Fatal(err)
			}
			if err := g.wait(func(w selenium.WebDriver) (bool, error) {
				value, err := w.ExecuteScript(`const [c,w,h]=arguments,r=c.getBoundingClientRect();return c.width===w&&c.height===h&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1`, []interface{}{g.canvas, size.frameWidth, size.frameHeight})
				return value == true, err
			}, 30*time.Second); err != nil {
				t.Fatalf("phone framebuffer: %v", err)
			}
			if err := g.canvas.SendKeys("h"); err != nil {
				t.Fatal(err)
			}
			if err := g.wait(func(selenium.WebDriver) (bool, error) {
				frame := g.snapshot()
				visible := 0
				for y := 20; y < size.frameHeight; y += 4 {
					for x := 0; x < size.frameWidth-168; x += 4 {
						r, g, b, _ := frame.At(x*frame.Bounds().Dx()/size.frameWidth, y*frame.Bounds().Dy()/size.frameHeight).RGBA()
						if colored(r>>8, g>>8, b>>8) {
							visible++
						}
					}
				}
				return visible > 200, nil
			}, 30*time.Second); err != nil {
				t.Fatalf("phone battlefield remained blank: %v", err)
			}
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				shot, err := g.driver.Screenshot()
				if err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, size.name+".png"), shot, 0644); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

func TestPhoneTouchDoesNotEdgeScroll(t *testing.T) {
	g := newFreewareBrowser(t)
	g.navigate()
	g.waitRunning()
	g.waitSelector()
	g.startSkirmish()
	g.deployStartingArmy()
	if err := g.driver.ExecuteChromiumCommand("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": true, "maxTouchPoints": 5}); err != nil {
		t.Fatal(err)
	}
	if err := g.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 844, "height": 390, "screenWidth": 844, "screenHeight": 390, "deviceScaleFactor": 3, "mobile": true}); err != nil {
		t.Fatal(err)
	}
	if err := g.wait(func(w selenium.WebDriver) (bool, error) {
		value, err := w.ExecuteScript("return arguments[0].width===675 && arguments[0].height===312", []interface{}{g.canvas})
		return value == true, err
	}, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	// Compare the battlefield rather than a camera diagnostic. Stationary terrain
	// stays put while sprites animate; edge scrolling moves almost every tile.
	unchangedTerrain := func(before, after image.Image) float64 {
		matched, total := 0, 0
		for y := 60; y < 290; y += 3 {
			for x := 10; x < 490; x += 3 {
				px, py := x*before.Bounds().Dx()/675, y*before.Bounds().Dy()/312
				r, green, b, _ := before.At(px, py).RGBA()
				if !colored(r>>8, green>>8, b>>8) {
					continue
				}
				total++
				r2, g2, b2, _ := after.At(px, py).RGBA()
				if math.Abs(float64(r)-float64(r2))+math.Abs(float64(green)-float64(g2))+math.Abs(float64(b)-float64(b2)) < 30*257 {
					matched++
				}
			}
		}
		if total < 100 {
			t.Fatal("not enough visible terrain to check scrolling")
		}
		return float64(matched) / float64(total)
	}
	for _, edge := range []struct {
		name string
		x    int
	}{{"left", 1}, {"right", 843}} {
		t.Run(edge.name, func(t *testing.T) {
			for _, kind := range []string{"touchEnd", "touchCancel"} {
				t.Run(kind, func(t *testing.T) {
					if err := g.driver.ExecuteChromiumCommand("Input.dispatchTouchEvent", map[string]any{"type": "touchStart", "touchPoints": []map[string]any{{"x": edge.x, "y": 190, "id": 1}}}); err != nil {
						t.Fatal(err)
					}
					g.advance(100 * time.Millisecond)
					if err := g.driver.ExecuteChromiumCommand("Input.dispatchTouchEvent", map[string]any{"type": kind, "touchPoints": []map[string]any{}}); err != nil {
						t.Fatal(err)
					}
					if err := g.canvas.SendKeys("h"); err != nil {
						t.Fatal(err)
					}
					g.advance(100 * time.Millisecond)
					before := g.snapshot()
					g.advance(time.Second)
					if unchanged := unchangedTerrain(before, g.snapshot()); unchanged < 0.75 {
						t.Fatalf("released touch kept scrolling: %.1f%% terrain stayed in place", unchanged*100)
					}
				})
			}
		})
	}
	// Touch-capable phones can also have a mouse attached. A genuine mouse
	// hovering at an edge must still move the map after the touch gestures.
	largestMovement := 0.0
	for _, x := range []int{1, 843} {
		g.dispatch(400, 190, "mouseMoved", 0)
		g.advance(300 * time.Millisecond)
		if err := g.canvas.SendKeys("h"); err != nil {
			t.Fatal(err)
		}
		g.advance(100 * time.Millisecond)
		before := g.snapshot()
		g.dispatch(x, 190, "mouseMoved", 0)
		g.advance(time.Second)
		largestMovement = math.Max(largestMovement, 1-unchangedTerrain(before, g.snapshot()))
	}
	if largestMovement < 0.25 {
		t.Fatalf("mouse hover no longer edge-scrolls: %.1f%% terrain moved", largestMovement*100)
	}
}
