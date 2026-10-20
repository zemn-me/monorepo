package testing_test

import (
	"regexp"
	"strconv"
	"testing"
	"time"
)

var multiplayerChecksums = regexp.MustCompile(`Multiplayer frame (\d+) checksum ([0-9a-f]+)`)

func (p *multiplayerBrowser) simulationFrames() map[int]string {
	p.t.Helper()
	frames := map[int]string{}
	for _, match := range multiplayerChecksums.FindAllStringSubmatch(p.logs(), -1) {
		frame, err := strconv.Atoi(match[1])
		if err != nil {
			p.t.Fatal(err)
		}
		frames[frame] = match[2]
	}
	return frames
}

func latestSimulationFrame(frames map[int]string) int {
	latest := 0
	for frame := range frames {
		latest = max(latest, frame)
	}
	return latest
}

func (p *multiplayerBrowser) assertVisibility(hidden bool) {
	p.t.Helper()
	raw, err := p.driver.ExecuteScript("return {hidden: document.hidden, focused: document.hasFocus()}", nil)
	if err != nil {
		p.t.Fatal(err)
	}
	state, ok := raw.(map[string]interface{})
	if !ok || state["hidden"] != hidden || state["focused"] != !hidden {
		p.t.Fatalf("%s visibility = %#v, want hidden=%v focused=%v", p.name, raw, hidden, !hidden)
	}
}

// Observe an uninterrupted wall-clock interval. Polling, screenshots, switching
// WebDriver windows, and executing scripts can disturb the background condition.
func observeMultiplayerProgress(t *testing.T, host, guest *multiplayerBrowser, hidden bool) (int, int) {
	t.Helper()
	host.assertVisibility(false)
	guest.assertVisibility(hidden)
	hostBefore := latestSimulationFrame(host.simulationFrames())
	guestBefore := latestSimulationFrame(guest.simulationFrames())
	began := time.Now()
	time.Sleep(30 * time.Second)
	host.assertVisibility(false)
	guest.assertVisibility(hidden)
	hostFrames, guestFrames := host.simulationFrames(), guest.simulationFrames()
	hostDelta := latestSimulationFrame(hostFrames) - hostBefore
	guestDelta := latestSimulationFrame(guestFrames) - guestBefore
	matched := 0
	for frame, checksum := range hostFrames {
		if frame <= max(hostBefore, guestBefore) {
			continue
		}
		if other, ok := guestFrames[frame]; ok {
			if checksum != other {
				t.Fatalf("frame %d desynchronized: host=%s guest=%s", frame, checksum, other)
			}
			matched++
		}
	}
	t.Logf("guest hidden=%v: host advanced %d frames, guest %d, %d matching checkpoints in %s", hidden, hostDelta, guestDelta, matched, time.Since(began))
	if matched < 2 {
		t.Errorf("guest hidden=%v: want at least two new shared checksum checkpoints, got %d", hidden, matched)
	}
	return hostDelta, guestDelta
}

func TestBrowserMultiplayerBackground(t *testing.T) {
	t.Setenv("TIBERIAN_MULTIPLAYER_REALTIME", "1")
	host, guest := startBrowserMultiplayer(t, true)
	if host.clock != nil || guest.clock != nil {
		t.Fatal("background scheduling requires native browser clocks")
	}
	host.wait("both engines reach simulation frame 480", func() bool {
		return latestSimulationFrame(host.simulationFrames()) >= 480 && latestSimulationFrame(guest.simulationFrames()) >= 480
	}, guest)
	baselineHost, baselineGuest := observeMultiplayerProgress(t, host, guest, false)
	if baselineHost < 240 || baselineGuest < 240 {
		t.Fatalf("foreground baseline too slow to measure background regression: host=%d guest=%d", baselineHost, baselineGuest)
	}

	// Release the focus override before activating a genuine second tab. Keep
	// WebDriver attached to the game: selecting it again would foreground it.
	if err := guest.driver.ExecuteChromiumCommand("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": false}); err != nil {
		t.Fatal(err)
	}
	if err := guest.driver.ExecuteChromiumCommand("Target.createTarget", map[string]any{"url": "about:blank", "background": false}); err != nil {
		t.Fatal(err)
	}
	guest.assertVisibility(true)
	// Let Chromium's short background grace period expire before measuring.
	time.Sleep(12 * time.Second)
	hiddenHost, hiddenGuest := observeMultiplayerProgress(t, host, guest, true)
	// A relative floor tolerates software-rendering differences across runners
	// while rejecting the order-of-magnitude slowdown of timer-clamped lockstep.
	if hiddenHost*2 < baselineHost || hiddenGuest*2 < baselineGuest {
		t.Errorf("background match fell below half its foreground progress: host %d/%d, guest %d/%d", hiddenHost, baselineHost, hiddenGuest, baselineGuest)
	}
	if err := guest.driver.ExecuteChromiumCommand("Page.bringToFront", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	if err := guest.driver.ExecuteChromiumCommand("Emulation.setFocusEmulationEnabled", map[string]any{"enabled": true}); err != nil {
		t.Fatal(err)
	}
	recoveredHost, recoveredGuest := observeMultiplayerProgress(t, host, guest, false)
	if recoveredHost*2 < baselineHost || recoveredGuest*2 < baselineGuest {
		t.Errorf("match did not recover on return: host %d/%d, guest %d/%d", recoveredHost, baselineHost, recoveredGuest, baselineGuest)
	}
}
