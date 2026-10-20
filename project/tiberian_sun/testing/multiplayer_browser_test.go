package testing_test

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/log"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

type multiplayerBrowser struct {
	t        *testing.T
	driver   *seleniumutil.Driver
	clock    *seleniumutil.VirtualClock
	messages strings.Builder
	name     string
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
	entries, err := p.driver.Log(log.Browser)
	if err != nil {
		p.t.Fatal(err)
	}
	for _, entry := range entries {
		p.messages.WriteString(entry.Message)
		p.messages.WriteByte('\n')
	}
	return p.messages.String()
}
func (p *multiplayerBrowser) mouse(x, y int, kind string, buttons int) {
	p.t.Helper()
	if err := p.driver.ExecuteChromiumCommand("Input.dispatchMouseEvent", map[string]any{"type": kind, "x": x, "y": y, "button": "left", "buttons": buttons, "clickCount": 1}); err != nil {
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
	data, err := p.driver.Screenshot()
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
	data, err := p.driver.Screenshot()
	if err != nil {
		p.t.Logf("%s: diagnostic capture %s unavailable: %v", p.name, name, err)
		return
	}
	if err := os.WriteFile(filepath.Join(dir, "multiplayer-"+p.name+"-"+name+".png"), data, 0644); err != nil {
		p.t.Logf("%s: save diagnostic capture %s: %v", p.name, name, err)
	}
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
	// ICE and network delivery remain real browser I/O. Only the game clocks advance.
	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		p.advance()
		for _, other := range others {
			other.advance()
		}
	}
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
	p := &multiplayerBrowser{t: t, driver: driver, name: name}
	t.Cleanup(func() {
		if data, err := driver.Screenshot(); err == nil {
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
		driver.Close()
	})
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}); err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Browser.grantPermissions", map[string]any{"origin": base, "permissions": []string{"clipboardReadWrite", "clipboardSanitizedWrite"}}); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("TIBERIAN_MULTIPLAYER_REALTIME") != "1" {
		var err error
		p.clock, err = seleniumutil.NewVirtualClock(driver)
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := driver.Get(base + "/experiments/tiberian-sun"); err != nil {
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
		raw, err := p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.readText().then(done,()=>done(''))", nil)
		if err != nil {
			p.t.Fatal(err)
		}
		code, _ = raw.(string)
		return strings.HasPrefix(code, "OPENTS1:") && code != previous
	})
	return code
}
func (p *multiplayerBrowser) pasteCode(code string) {
	p.t.Helper()
	if _, err := p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.writeText(arguments[0]).then(()=>done(true),e=>done(String(e)))", []interface{}{code}); err != nil {
		p.t.Fatal(err)
	}
	p.click(210, 340)
	p.advance()
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
	guest := newMultiplayerBrowser(t, base, "guest", backgroundThrottling)
	host.captureStep("choose")
	host.click(210, 244) // Host a game.
	offer := host.copyCode("")
	host.captureStep("invitation")
	host.click(550, 222) // Next, then back: keep the original invitation valid.
	host.click(180, 465)
	if again := host.copyCode(""); again != offer {
		t.Fatal("Back replaced the invitation")
	}
	host.click(550, 222)  // Next: enter reply.
	guest.click(210, 308) // Join a game.
	// Invalid input stays in this form and produces an actionable error.
	guest.pasteCode("not a connection code")
	guest.wait("invalid invitation feedback", func() bool {
		return strings.Contains(guest.logs(), "Paste the complete invitation code from the host.")
	})
	guest.captureStep("invalid-invitation")
	if err := guest.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		guest.advance()
	}
	guest.captureStep("phone-invalid-invitation")
	if err := guest.driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		guest.advance()
	}
	guest.pasteCode(offer)
	answer := guest.copyCode(offer)
	guest.captureStep("reply")
	if answer == offer {
		t.Fatal("guest did not produce its own reply")
	}
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
	host.captureStep("reply-keyboard-focus")
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
	host.captureStep("connected")
	guest.captureStep("connected")
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
	for i := 0; i < 30; i++ {
		host.advance()
		guest.advance()
	}
	guest.click(590, 170) // Host's game below the Lobby row.
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
