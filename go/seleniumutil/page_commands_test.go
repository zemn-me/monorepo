package selenium_test

import (
	"bytes"
	"context"
	"github.com/tebeka/selenium"
	"image"
	"image/png"
	"net/url"
	"strings"
	"testing"
	"time"

	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestPageCommandWhileRendererBusy(t *testing.T) {
	ctx := pageCommandContext(t)
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	commands, err := driver.OpenPageCommands()
	if err != nil {
		t.Fatal(err)
	}
	defer commands.Close()
	console, err := driver.WatchConsole()
	if err != nil {
		t.Fatal(err)
	}
	defer console.Close()
	page := `<script>setTimeout(() => {
console.log('command-renderer-busy');
const until = Date.now() + 2500;
while (Date.now() < until) {}
console.log('command-renderer-ready');
}, 300);</script>`
	if err := driver.Get("data:text/html," + url.PathEscape(page)); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		text, err := console.Text()
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(text, "command-renderer-busy") && !strings.Contains(text, "command-renderer-ready") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("did not observe the occupied renderer")
		}
		time.Sleep(5 * time.Millisecond)
	}
	started := time.Now()
	if err := commands.Execute(ctx, "Page.bringToFront", map[string]any{}, nil); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("browser command waited for renderer JavaScript: %s", elapsed)
	}
}

func TestPageCommandsViewScreenshotDuringAnimation(t *testing.T) {
	ctx := pageCommandContext(t)
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{
		"goog:chromeOptions": map[string]any{
			"excludeSwitches": []string{"disable-background-timer-throttling", "disable-backgrounding-occluded-windows", "disable-renderer-backgrounding"},
		},
	}, "--window-size=1000,900", "--use-angle=swiftshader", "--enable-unsafe-swiftshader")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { driver.Close() })
	commands, err := driver.OpenPageCommands()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { commands.Close() })
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := driver.Get("data:text/html," + url.PathEscape(`<style>body{margin:0}</style><canvas width="800" height="600"></canvas><script>
const canvas=document.querySelector('canvas'), gl=canvas.getContext('webgl');
let frame=0;
function draw(){gl.clearColor(0,0,1,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.SCISSOR_TEST);gl.scissor(100,400,100,100);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);canvas.dataset.frame=++frame;requestAnimationFrame(draw);}draw();
</script>`)); err != nil {
		t.Fatal(err)
	}
	before, err := driver.ExecuteScript("return Number(document.querySelector('canvas').dataset.frame)", nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, size := range []image.Point{{X: 800, Y: 600}, {X: 390, Y: 844}, {X: 800, Y: 600}} {
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": size.X, "height": size.Y, "deviceScaleFactor": 1, "mobile": false}); err != nil {
			t.Fatal(err)
		}
		for range 10 {
			data, err := commands.ViewScreenshot(ctx)
			if err != nil {
				t.Fatal(err)
			}
			shot, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatal(err)
			}
			if shot.Bounds().Dx() != size.X || shot.Bounds().Dy() != size.Y {
				t.Fatalf("screenshot bounds = %v, want %dx%d", shot.Bounds(), size.X, size.Y)
			}
			r, g, b, _ := shot.At(120, 120).RGBA()
			if r < 60000 || g < 60000 || b < 60000 {
				t.Fatalf("white control pixel = %d,%d,%d", r, g, b)
			}
			r, g, b, _ = shot.At(10, 10).RGBA()
			if r > 1000 || g > 1000 || b < 60000 {
				t.Fatalf("blue background pixel = %d,%d,%d", r, g, b)
			}
		}
	}
	after, err := driver.ExecuteScript("return Number(document.querySelector('canvas').dataset.frame)", nil)
	if err != nil {
		t.Fatal(err)
	}
	if after.(float64) <= before.(float64) {
		t.Fatalf("animation stopped during capture: %v -> %v", before, after)
	}
}

func TestPageCommandsFocusTransition(t *testing.T) {
	ctx := pageCommandContext(t)
	driver, err := seleniumutil.NewWithChromeCapabilities(selenium.Capabilities{
		"goog:chromeOptions": map[string]any{
			"excludeSwitches": []string{"disable-background-timer-throttling", "disable-backgrounding-occluded-windows", "disable-renderer-backgrounding"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	commands, err := driver.OpenPageCommands()
	if err != nil {
		t.Fatal(err)
	}
	defer commands.Close()
	if err := commands.Execute(ctx, "Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}, nil); err != nil {
		t.Fatal(err)
	}
	if err := driver.Get("data:text/html," + url.PathEscape("<h1>Game tab</h1>")); err != nil {
		t.Fatal(err)
	}
	if err := commands.Execute(ctx, "Target.createTarget", map[string]any{"url": "about:blank", "background": false}, nil); err != nil {
		t.Fatal(err)
	}
	if err := commands.Execute(ctx, "Emulation.setFocusEmulationEnabled", map[string]any{"enabled": false}, nil); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		state, err := wd.ExecuteScript("return document.hidden && !document.hasFocus()", nil)
		return state == true, err
	}, 5*time.Second); err != nil {
		t.Fatalf("game tab did not become hidden after releasing focus: %v", err)
	}
	if err := commands.Execute(ctx, "Page.bringToFront", map[string]any{}, nil); err != nil {
		t.Fatal(err)
	}
	if err := commands.Execute(ctx, "Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}, nil); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		state, err := wd.ExecuteScript("return !document.hidden && document.hasFocus()", nil)
		return state == true, err
	}, 5*time.Second); err != nil {
		t.Fatalf("game tab did not regain visible focus: %v", err)
	}
}

func pageCommandContext(t *testing.T) context.Context {
	t.Helper()
	deadline, ok := t.Deadline()
	if !ok {
		t.Fatal("browser test requires a scenario deadline")
	}
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	t.Cleanup(cancel)
	return ctx
}

func TestPageCommandsRespectDeadline(t *testing.T) {
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	commands, err := driver.OpenPageCommands()
	if err != nil {
		t.Fatal(err)
	}
	defer commands.Close()
	ctx, cancel := context.WithTimeout(pageCommandContext(t), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	err = commands.Execute(ctx, "Runtime.evaluate", map[string]any{"expression": "new Promise(() => {})", "awaitPromise": true}, nil)
	if err == nil {
		t.Fatal("unfinished browser operation succeeded")
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("command exceeded its cancellation budget: %s", elapsed)
	}
}

func TestPageCommandsEvaluate(t *testing.T) {
	ctx := pageCommandContext(t)
	driver, err := seleniumutil.New()
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	commands, err := driver.OpenPageCommands()
	if err != nil {
		t.Fatal(err)
	}
	defer commands.Close()
	if err := driver.Get("data:text/html," + url.PathEscape("<title>Real page</title>")); err != nil {
		t.Fatal(err)
	}
	var title string
	if err := commands.Evaluate(ctx, "Promise.resolve(document.title)", &title); err != nil {
		t.Fatal(err)
	}
	if title != "Real page" {
		t.Fatalf("title = %q", title)
	}
	if err := commands.Evaluate(ctx, "Promise.reject(new Error('expected rejection'))", &title); err == nil || !strings.Contains(err.Error(), "expected rejection") {
		t.Fatalf("JavaScript rejection = %v", err)
	}
	if err := commands.Evaluate(ctx, "undefined", &title); err == nil {
		t.Fatal("undefined silently produced a value")
	}
}
