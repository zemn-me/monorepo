package testing_test

import (
	"fmt"
	"github.com/tebeka/selenium"
	"regexp"
	"testing"
)

func TestBrowserMultiplayer(t *testing.T) {
	host, guest := startBrowserMultiplayer(t, false)
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
	// Continue the same match through hiding and restoring the guest tab.
	// Virtual time drives simulation; the real WebRTC channel still delivers packets.
	for _, hidden := range []bool{true, false} {
		before := max(latestSimulationFrame(host.simulationFrames()), latestSimulationFrame(guest.simulationFrames()))
		if hidden {
			if err := guest.command("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": false}); err != nil {
				t.Fatal(err)
			}
			if err := guest.command("Target.createTarget", map[string]any{"url": "about:blank", "background": false}); err != nil {
				t.Fatal(err)
			}
		} else {
			if err := guest.command("Page.bringToFront", map[string]any{}); err != nil {
				t.Fatal(err)
			}
			if err := guest.command("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}); err != nil {
				t.Fatal(err)
			}
		}
		guest.wait(fmt.Sprintf("guest hidden=%v", hidden), func() bool {
			raw, err := guest.driver.ExecuteScript("return document.hidden", nil)
			if err != nil {
				t.Fatal(err)
			}
			return raw == hidden
		}, host)
		guest.assertVisibility(hidden)
		host.wait(fmt.Sprintf("shared simulation progresses with guest hidden=%v", hidden), func() bool {
			matched := 0
			guestFrames := guest.simulationFrames()
			for frame, checksum := range host.simulationFrames() {
				if frame <= before {
					continue
				}
				if other, ok := guestFrames[frame]; ok {
					if other != checksum {
						t.Fatalf("frame %d desynchronized with guest hidden=%v: host=%s guest=%s", frame, hidden, checksum, other)
					}
					matched++
				}
			}
			return matched >= 3
		}, guest)
		guest.assertVisibility(hidden)
	}

}
