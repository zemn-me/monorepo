package testing_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"regexp"
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
		p.t.Fatal(err)
	}
}
func (p *multiplayerBrowser) click(x, y int) {
	p.t.Helper()
	p.mouse(x, y, "mouseMoved", 0)
	p.mouse(x, y, "mousePressed", 1)
	p.advance()
	p.mouse(x, y, "mouseReleased", 0)
	p.advance()
}
func (p *multiplayerBrowser) screenshot() image.Image {
	p.t.Helper()
	data, err := p.driver.Screenshot()
	if err != nil {
		p.t.Fatal(err)
	}
	frame, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		p.t.Fatal(err)
	}
	return frame
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
func newMultiplayerBrowser(t *testing.T, base, name string) *multiplayerBrowser {
	t.Helper()
	driver := newGameBrowser(t, "--window-size=1000,900", "--disable-features=WebRtcHideLocalIpsWithMdns")
	p := &multiplayerBrowser{t: t, driver: driver, name: name}
	t.Cleanup(func() {
		if data, err := driver.Screenshot(); err == nil {
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				_ = os.WriteFile(filepath.Join(dir, "multiplayer-"+name+".png"), data, 0644)
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
	var err error
	p.clock, err = seleniumutil.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
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
func (p *multiplayerBrowser) copyCode() string {
	p.t.Helper()
	var code string
	p.wait("connection code", func() bool {
		p.click(400, 175)
		raw, err := p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.readText().then(done,()=>done(''))", nil)
		if err != nil {
			p.t.Fatal(err)
		}
		code, _ = raw.(string)
		return strings.HasPrefix(code, "OPENTS1:")
	})
	return code
}
func (p *multiplayerBrowser) pasteCode(code string) {
	p.t.Helper()
	if _, err := p.driver.ExecuteScriptAsync("const done=arguments[arguments.length-1];navigator.clipboard.writeText(arguments[0]).then(()=>done(true),e=>done(String(e)))", []interface{}{code}); err != nil {
		p.t.Fatal(err)
	}
	p.click(190, 405)
	p.advance()
	p.click(400, 405)
}

func TestBrowserMultiplayer(t *testing.T) {
	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	base := "http://localhost:" + ports.Site
	host := newMultiplayerBrowser(t, base, "host")
	guest := newMultiplayerBrowser(t, base, "guest")
	host.click(190, 175)
	offer := host.copyCode()
	guest.pasteCode(offer)
	answer := guest.copyCode()
	if answer == offer {
		t.Fatal("guest did not produce its own reply")
	}
	host.pasteCode(answer)
	host.wait("direct connection", func() bool {
		return strings.Contains(host.logs(), "WebRTC game channel connected") && strings.Contains(guest.logs(), "WebRTC game channel connected")
	}, guest)
	host.click(220, 455)
	guest.click(220, 455)
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
	// Issue genuine orders from both clients before checking continued lockstep.
	for _, p := range []*multiplayerBrowser{host, guest} {
		p.mouse(120, 100, "mouseMoved", 0)
		p.mouse(120, 100, "mousePressed", 1)
		for step := 1; step <= 10; step++ {
			p.mouse(120+step*39, 100+step*26, "mouseMoved", 1)
			host.advance()
			guest.advance()
		}
		p.mouse(510, 360, "mouseReleased", 0)
		host.advance()
		guest.advance()
		canvas, err := p.driver.FindElement(selenium.ByCSSSelector, "canvas")
		if err != nil {
			t.Fatal(err)
		}
		if err := canvas.SendKeys("d"); err != nil {
			t.Fatal(err)
		}
		host.advance()
		guest.advance()
	}
	for _, p := range []*multiplayerBrowser{host, guest} {
		p.wait("construction yard unlocks the power plant", func() bool {
			frame := p.screenshot()
			count := 0
			for y := 178; y < 220; y++ {
				for x := 656; x < 719; x++ {
					r, g, b, _ := frame.At(x, y).RGBA()
					if r > 9000 || g > 9000 || b > 9000 {
						count++
					}
				}
			}
			return count > 1100
		}, host, guest)
	}
	checksums := regexp.MustCompile(`Multiplayer frame (\d+) checksum ([0-9a-f]+)`)
	host.wait("matching simulation checksums beyond startup suppression", func() bool {
		a, b := host.logs(), guest.logs()
		have := map[string]string{}
		for _, match := range checksums.FindAllStringSubmatch(a, -1) {
			have[match[1]] = match[2]
		}
		matched := map[string]bool{}
		for _, match := range checksums.FindAllStringSubmatch(b, -1) {
			if theirs, ok := have[match[1]]; ok {
				var frame int
				fmt.Sscan(match[1], &frame)
				if frame < 360 {
					continue
				}
				if theirs != match[2] {
					t.Fatalf("desynchronized frame %s: host=%s guest=%s", match[1], theirs, match[2])
				}
				matched[match[1]] = true
			}
		}
		return len(matched) >= 3
	}, guest)
}
