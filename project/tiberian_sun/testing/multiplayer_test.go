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
}
