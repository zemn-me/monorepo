package testing_test

import (
	"bytes"
	"context"
	"encoding/json"
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

type multiplayerBrowser struct {
	t            *testing.T
	driver       *seleniumutil.Driver
	clock        *seleniumutil.VirtualClock
	console      *seleniumutil.ConsoleLog
	page         *seleniumutil.PageCommands
	waitDeadline time.Time
	name         string
}

func (p *multiplayerBrowser) trace(operation string) func() {
	p.t.Helper()
	if p.clock != nil {
		return func() {}
	}
	began := time.Now()
	p.t.Logf("%s: begin %s at %s", p.name, operation, began.UTC().Format(time.RFC3339Nano))
	return func() { p.t.Logf("%s: end %s after %s", p.name, operation, time.Since(began)) }
}

func (p *multiplayerBrowser) advance() {
	p.t.Helper()
	if p.clock == nil {
		time.Sleep(50 * time.Millisecond)
		return
	}
	if err := p.clock.Advance(100 * time.Millisecond); err != nil {
		p.t.Fatal(err)
	}
}
func (p *multiplayerBrowser) logs() string {
	p.t.Helper()
	text, err := p.console.Text()
	if err != nil {
		p.t.Fatal(err)
	}
	return text
}

// Command time counts against the existing UI wait and scenario deadlines.
func (p *multiplayerBrowser) commandContext() (context.Context, context.CancelFunc) {
	deadline := time.Now().Add(90 * time.Second)
	if !p.waitDeadline.IsZero() && p.waitDeadline.Before(deadline) {
		deadline = p.waitDeadline
	}
	if end, ok := p.t.Deadline(); ok && end.Before(deadline) {
		deadline = end
	}
	return context.WithDeadline(context.Background(), deadline)
}

// Browser-only commands must not wait for ChromeDriver's renderer probes.
func (p *multiplayerBrowser) command(method string, params map[string]any) error {
	if p.page != nil {
		ctx, cancel := p.commandContext()
		defer cancel()
		return p.page.Execute(ctx, method, params, nil)
	}
	return p.driver.ExecuteChromiumCommand(method, params)
}
func (p *multiplayerBrowser) viewScreenshot() ([]byte, error) {
	if p.page != nil {
		ctx, cancel := p.commandContext()
		defer cancel()
		return p.page.ViewScreenshot(ctx)
	}
	return p.driver.ViewScreenshot()
}

func (p *multiplayerBrowser) mouse(x, y int, kind string, buttons int) {
	p.t.Helper()
	defer p.trace("mouse " + kind)()
	if err := p.command("Input.dispatchMouseEvent", map[string]any{"type": kind, "x": x, "y": y, "button": "left", "buttons": buttons, "clickCount": 1}); err != nil {
		p.t.Fatalf("%s: mouse %s at (%d, %d): %v", p.name, kind, x, y, err)
	}
}
func (p *multiplayerBrowser) click(x, y int) {
	p.t.Helper()
	p.mouse(x, y, "mouseMoved", 0)
	// The native menu consumes motion at an Asyncify yield before handling press.
	p.advance()
	p.mouse(x, y, "mousePressed", 1)
	p.advance()
	p.mouse(x, y, "mouseReleased", 0)
	p.advance()
}
func (p *multiplayerBrowser) screenshot() image.Image {
	p.t.Helper()
	defer p.trace("pixel screenshot")()
	data, err := p.viewScreenshot()
	if err != nil {
		p.t.Fatalf("%s: screenshot: %v", p.name, err)
	}
	frame, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		p.t.Fatal(err)
	}
	return frame
}

// Diagnostic captures supplement the behavior assertions. A compositor capture
// can time out while a real-time peer keeps rendering; it must not stop the match.
func (p *multiplayerBrowser) captureStep(name string) {
	p.t.Helper()
	dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR")
	if dir == "" {
		return
	}
	defer p.trace("diagnostic screenshot " + name)()
	data, err := p.viewScreenshot()
	if err != nil {
		p.t.Logf("%s: diagnostic capture %s unavailable: %v", p.name, name, err)
		return
	}
	if err := os.WriteFile(filepath.Join(dir, "multiplayer-"+p.name+"-"+name+".png"), data, 0644); err != nil {
		p.t.Logf("%s: save diagnostic capture %s: %v", p.name, name, err)
	}
}

// A diagnostic readback may wait for the compositor. Overlap it only with
// independent work in the other browser; keep this page unchanged until done.
func (p *multiplayerBrowser) captureStepWhile(name string, other func()) {
	if p.page == nil {
		p.captureStep(name)
		other()
		return
	}
	done := make(chan struct{})
	go func() { defer close(done); p.captureStep(name) }()
	defer func() { <-done }()
	other()
}

func (p *multiplayerBrowser) white(x, y int) bool {
	frame := p.screenshot()
	count := 0
	for py := y - 8; py < y+10; py++ {
		for px := x - 30; px < x+30; px++ {
			r, g, b, _ := frame.At(px, py).RGBA()
			if r > 51000 && g > 51000 && b > 51000 {
				count++
			}
		}
	}
	return count > 30
}
func (p *multiplayerBrowser) wait(label string, condition func() bool, others ...*multiplayerBrowser) {
	p.t.Helper()
	p.t.Logf("%s: waiting for %s", p.name, label)
	defer p.trace("wait " + label)()
	// ICE and network delivery remain real browser I/O. Only the game clocks advance.
	deadline := time.Now().Add(90 * time.Second)
	for _, peer := range append([]*multiplayerBrowser{p}, others...) {
		previous := peer.waitDeadline
		if previous.IsZero() || deadline.Before(previous) {
			peer.waitDeadline = deadline
		}
		defer func(peer *multiplayerBrowser, previous time.Time) { peer.waitDeadline = previous }(peer, previous)
	}
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		p.advance()
		for _, other := range others {
			other.advance()
		}
	}
	p.t.Logf("%s: console on failed %s:\n%s", p.name, label, p.logs())
	state, err := p.driver.ExecuteScript(`const c=document.querySelector('canvas'), r=c?.getBoundingClientRect(); return {viewport:[innerWidth,innerHeight], screen:[screen.width,screen.height], hidden:document.hidden, canvas:c&&{width:c.width,height:c.height,rect:r&&[r.x,r.y,r.width,r.height]}}`, nil)
	p.t.Logf("%s: layout on failed %s: %v (error=%v)", p.name, label, state, err)
	p.captureStep("failed-" + strings.ReplaceAll(label, " ", "-"))
	p.t.Fatalf("%s: %s", p.name, label)
}
func newMultiplayerBrowser(t *testing.T, base, name string, backgroundThrottling bool) *multiplayerBrowser {
	t.Helper()
	var capabilities selenium.Capabilities
	if backgroundThrottling {
		capabilities = selenium.Capabilities{"goog:chromeOptions": map[string]any{
			// ChromeDriver normally disables the behavior this scenario measures.
			"excludeSwitches": []string{"disable-background-timer-throttling", "disable-backgrounding-occluded-windows", "disable-renderer-backgrounding"},
		}}
	}
	driver := newGameBrowserWithCapabilities(t, capabilities, "--window-size=1000,900", "--disable-features=WebRtcHideLocalIpsWithMdns")
	console, err := driver.WatchConsole()
	if err != nil {
		driver.Close()
		t.Fatal(err)
	}
	p := &multiplayerBrowser{t: t, driver: driver, name: name, console: console}
	if backgroundThrottling {
		p.page, err = driver.OpenPageCommands()
		if err != nil {
			console.Close()
			driver.Close()
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		if data, err := p.viewScreenshot(); err == nil {
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				_ = os.WriteFile(filepath.Join(dir, "multiplayer-"+name+".png"), data, 0644)
			}
		}
		if os.Getenv("TIBERIAN_MULTIPLAYER_REALTIME") == "1" {
			text := p.logs()
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				if err := os.WriteFile(filepath.Join(dir, "performance-"+name+".log"), []byte(text), 0644); err != nil {
					t.Error(err)
				}
			}
			for _, line := range strings.Split(text, "\n") {
				if strings.Contains(line, "Multiplayer performance ") || strings.Contains(line, "Network timing evaluation") {
					t.Log(name + ": " + line)
				}
			}
		}
		if t.Failed() {
			text := p.logs()
			if len(text) > 22000 {
				text = text[len(text)-22000:]
			}
			t.Log(name + ":\n" + text)
		}
		if p.page != nil {
			p.page.Close()
		}
		console.Close()
		driver.Close()
	})
	if err := p.command("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := p.command("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}); err != nil {
		t.Fatal(err)
	}
	if err := p.command("Browser.grantPermissions", map[string]any{"origin": base, "permissions": []string{"clipboardReadWrite", "clipboardSanitizedWrite"}}); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("TIBERIAN_MULTIPLAYER_REALTIME") != "1" {
		var err error
		p.clock, err = seleniumutil.NewVirtualClock(driver)
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := driver.GetWithNetworkRetry(base + "/experiments/tiberian-sun"); err != nil {
		t.Fatal(err)
	}

	p.wait("game selector", func() bool { p.mouse(120, 110, "mouseMoved", 0); return p.white(120, 110) })
	p.click(240, 300)
	p.wait("Internet button highlight", func() bool { p.mouse(400, 350, "mouseMoved", 0); return p.white(400, 350) })
	p.click(400, 350)
	p.wait("Internet connection dialog", func() bool {
		if strings.Contains(p.logs(), "webpeer.rml opened") {
			return true
		}
		p.click(400, 350)
		return false
	})
	return p
}
func (p *multiplayerBrowser) copyCode(previous string) string {
	p.t.Helper()
	var code string
	p.wait("connection code", func() bool {
		p.click(210, 222)
		var raw any
		var err error
		if p.page != nil {
			ctx, cancel := p.commandContext()
			err = p.page.Evaluate(ctx, "navigator.clipboard.readText().catch(() => '')", &raw)
			cancel()
		} else {
			raw, err = p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.readText().then(done,()=>done(''))", nil)
		}
		if err != nil {
			p.t.Fatal(err)
		}
		code, _ = raw.(string)
		return strings.HasPrefix(code, "OPENTS1:") && code != previous
	})
	return code
}
func (p *multiplayerBrowser) resizeMenu(width, height int) {
	p.t.Helper()
	if err := p.command("Emulation.setDeviceMetricsOverride", map[string]any{"width": width, "height": height, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		p.t.Fatal(err)
	}
	p.wait("menu viewport layout", func() bool {
		ready, err := p.driver.ExecuteScript(`const [w,h]=arguments, c=document.querySelector('canvas');
		if (!c || innerWidth!==w || innerHeight!==h) return false;
		const r=c.getBoundingClientRect(), scale=Math.min(w/800,h/600);
		return c.width===800 && c.height===600 &&
		 Math.abs(r.width-800*scale)<1 && Math.abs(r.height-600*scale)<1 &&
		 Math.abs(r.x-(w-r.width)/2)<1 && Math.abs(r.y-(h-r.height)/2)<1;`, []interface{}{width, height})
		if err != nil {
			p.t.Fatal(err)
		}
		return ready == true
	})
}

func (p *multiplayerBrowser) pasteCode(code string) {
	p.t.Helper()
	var result any
	var err error
	if p.page != nil {
		encoded, marshalErr := json.Marshal(code)
		if marshalErr != nil {
			p.t.Fatal(marshalErr)
		}
		ctx, cancel := p.commandContext()
		err = p.page.Evaluate(ctx, "navigator.clipboard.writeText("+string(encoded)+").then(() => true, e => String(e))", &result)
		cancel()
	} else {
		result, err = p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.writeText(arguments[0]).then(()=>done(true),e=>done(String(e)))", []interface{}{code})
	}
	if err != nil || result != true {
		p.t.Fatalf("write clipboard: result=%v, error=%v", result, err)
	}
	// A viewport change can finish after the browser acknowledges its resize.
	// Wait for the actual menu to accept input at the desktop coordinates.
	p.wait("Paste button is ready", func() bool {
		// SDL drops unchanged mouse coordinates. After a resize, send a fresh
		// gesture and let the native menu consume it before reading the hover.
		p.mouse(210, 360, "mouseMoved", 0)
		p.advance()
		p.mouse(210, 340, "mouseMoved", 0)
		p.advance()
		return p.white(210, 340)
	})
	p.click(210, 270) // Clear the previous invitation or reply through its text field.
	canvas, err := p.driver.FindElement(selenium.ByCSSSelector, "canvas")
	if err != nil {
		p.t.Fatal(err)
	}
	if err := canvas.SendKeys(selenium.ControlKey + "a" + selenium.NullKey + selenium.BackspaceKey); err != nil {
		p.t.Fatal(err)
	}
	p.wait("empty input disables acceptance", func() bool {
		p.mouse(550, 340, "mouseMoved", 0)
		return !p.white(550, 340)
	})
	p.click(210, 340)
	// Clipboard reads are real asynchronous browser I/O. Advancing a fixed
	// number of game ticks does not guarantee the pasted text has arrived.
	p.wait("pasted code enables acceptance", func() bool {
		p.mouse(550, 340, "mouseMoved", 0)
		return p.white(550, 340)
	})
	p.click(550, 340)
}

func startBrowserMultiplayer(t *testing.T, backgroundThrottling bool) (*multiplayerBrowser, *multiplayerBrowser) {
	t.Helper()
	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	base := "http://localhost:" + ports.Site
	host := newMultiplayerBrowser(t, base, "host", backgroundThrottling)
	var guest *multiplayerBrowser
	host.captureStepWhile("choose", func() {
		guest = newMultiplayerBrowser(t, base, "guest", backgroundThrottling)
	})
	host.click(210, 244) // Host a game.
	offer := host.copyCode("")
	joinGuest := func() {
		guest.click(210, 308) // Join a game.
		guest.pasteCode("not a connection code")
	}
	if backgroundThrottling {
		host.captureStepWhile("invitation", joinGuest)
	} else {
		host.captureStep("invitation")
	}
	host.click(550, 222) // Next, then back: keep the original invitation valid.
	host.click(180, 465)
	if again := host.copyCode(""); again != offer {
		t.Fatal("Back replaced the invitation")
	}
	host.click(550, 222) // Next: enter reply.
	// Invalid input stays in this form and produces an actionable error.
	if !backgroundThrottling {
		joinGuest()
	}
	guest.wait("invalid invitation feedback", func() bool {
		return strings.Contains(guest.logs(), "Paste the complete invitation code from the host.")
	})
	guest.captureStep("invalid-invitation")
	guest.resizeMenu(390, 844)
	guest.captureStep("phone-invalid-invitation")
	guest.resizeMenu(800, 600)
	// Exercise host validation before the guest starts ICE. Return the reply
	// promptly so browser input and diagnostic captures cannot exhaust ICE
	// connectivity checks while the host is still testing invalid input.
	host.pasteCode(offer)
	host.wait("own invitation feedback", func() bool {
		return strings.Contains(host.logs(), "That is your code. Paste the code your opponent sent back.")
	})
	canvas, err := host.driver.FindElement(selenium.ByCSSSelector, "canvas")
	if err != nil {
		t.Fatal(err)
	}
	if err := canvas.SendKeys(selenium.TabKey); err != nil {
		t.Fatal(err)
	}
	host.advance()
	var answer string
	host.captureStepWhile("reply-keyboard-focus", func() {
		guest.pasteCode(offer)
		answer = guest.copyCode(offer)
	})
	guest.captureStep("reply")
	if answer == offer {
		t.Fatal("guest did not produce its own reply")
	}
	host.pasteCode(answer)
	host.wait("direct connection", func() bool {
		return strings.Contains(host.logs(), "WebRTC game channel connected") && strings.Contains(guest.logs(), "WebRTC game channel connected")
	}, guest)
	for _, p := range []*multiplayerBrowser{host, guest} {
		p.wait("Continue button is visible", func() bool {
			p.mouse(250, 340, "mouseMoved", 0)
			return p.white(250, 340)
		}, host, guest)
	}
	host.captureStepWhile("connected", func() { guest.captureStep("connected") })
	host.click(250, 340)
	guest.click(250, 340)
	host.wait("network lobby", func() bool {
		return strings.Contains(host.logs(), "netlobby.rml opened") && strings.Contains(guest.logs(), "netlobby.rml opened")
	}, guest)
	// Set different player names through the original lobby's text field.
	for _, p := range []*multiplayerBrowser{host, guest} {
		p.click(255, 128)
		canvas, err := p.driver.FindElement(selenium.ByCSSSelector, "canvas")
		if err != nil {
			t.Fatal(err)
		}
		if err := canvas.SendKeys(selenium.ControlKey + "a" + selenium.NullKey + p.name); err != nil {
			t.Fatal(err)
		}
		p.click(400, 140)
	}
	host.click(645, 465) // New game.
	host.wait("host game setup", func() bool { return strings.Contains(host.logs(), "netgame.rml opened") }, guest)
	// Discovery arrives over real network I/O. Wait for the host row's selected
	// background before joining, including on slow real-time browser runners.
	guest.wait("host game row selected", func() bool {
		guest.click(590, 170) // Host's game below the Lobby row.
		frame := guest.screenshot()
		r, g, b, _ := frame.At(680, 170).RGBA()
		return r>>8 == 0x22 && g>>8 == 0x50 && b>>8 == 0x61
	}, host)
	guest.click(520, 465) // Join.
	guest.wait("guest game setup", func() bool { return strings.Contains(guest.logs(), "netgame.rml opened") }, host)
	host.wait("both engines generate a scenario", func() bool {
		a, b := host.logs(), guest.logs()
		if strings.Contains(a, "Finished unit generation") && strings.Contains(b, "Finished unit generation") {
			return true
		}
		// Joining publishes the final game options asynchronously and clears ready.
		// Keep accepting those options until the host has actually left its lobby.
		if !strings.Contains(a, "netgame.rml closed") {
			guest.click(650, 465)
			host.advance()
			guest.advance()
			host.click(650, 470)
		}
		return false
	}, guest)
	host.wait("both engines leave startup", func() bool {
		return strings.Contains(host.logs(), "Multiplayer frame 120 checksum") && strings.Contains(guest.logs(), "Multiplayer frame 120 checksum")
	}, guest)
	return host, guest
}
