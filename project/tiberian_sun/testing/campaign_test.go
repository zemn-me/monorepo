package testing_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tebeka/selenium"
	seleniumutil "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestBioCampaign(t *testing.T) {
	var ports struct {
		Site string `json:"@@//project/tiberian_sun/testing:site"`
	}
	if err := json.Unmarshal([]byte(os.Getenv("ASSIGNED_PORTS")), &ports); err != nil || ports.Site == "" {
		t.Fatalf("assigned site port: %v", err)
	}
	driver := newGameBrowser(t, "--window-size=1100,900")
	p := &multiplayerBrowser{t: t, driver: driver, name: "bio campaign"}
	t.Cleanup(func() {
		if data, err := driver.Screenshot(); err == nil {
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				_ = os.WriteFile(filepath.Join(dir, "bio-campaign-game.png"), data, 0644)
			}
		}
		if t.Failed() {
			t.Log(p.logs())
		}
		driver.Close()
	})
	var err error
	p.clock, err = seleniumutil.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	if err := driver.Get("http://localhost:" + ports.Site + "/experiments/tiberian-sun"); err != nil {
		t.Fatal(err)
	}
	p.wait("interactive game selector", func() bool { p.mouse(120, 110, "mouseMoved", 0); return p.white(120, 110) })
	p.click(240, 300) // Original Tiberian Sun disc.
	// New Campaign is white in the menu artwork before input is enabled.
	// Use a different item's hover response to wait for the menu transition.
	p.wait("interactive game menu", func() bool { p.mouse(400, 408, "mouseMoved", 0); return p.white(400, 408) })
	p.wait("New Campaign button", func() bool { p.mouse(400, 260, "mouseMoved", 0); return p.white(400, 260) })
	p.click(400, 260)
	p.wait("native campaign menu", func() bool { return strings.Contains(p.logs(), "campaign.rml opened") })
	if data, err := driver.Screenshot(); err == nil {
		if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
			_ = os.WriteFile(filepath.Join(dir, "bio-campaign-menu.png"), data, 0644)
		}
	}
	p.click(400, 327) // Third row, after the original GDI and Nod campaigns.
	p.click(435, 458) // OK.
	p.wait("native bio scenario starts", func() bool {
		text := p.logs()
		if strings.Contains(text, "Could not start the game") || strings.Contains(text, "RuntimeError") || strings.Contains(text, "Unable to read scenario") {
			t.Fatalf("campaign launch failed: %s", text)
		}
		return strings.Contains(text, "Reading scenario: BIO01.INI")
	})
	p.wait("native mission briefing", func() bool { return strings.Contains(p.logs(), "restate.rml shown") })
	canvas, err := driver.FindElement(selenium.ByCSSSelector, "canvas[aria-label='Tiberian Sun game']")
	if err != nil {
		t.Fatal(err)
	}
	// Advance the actual briefing, including any text pagination, through input.
	p.wait("mission briefing dismissed", func() bool {
		if strings.Contains(p.logs(), "restate.rml closed") {
			return true
		}
		if err := canvas.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		for tick := 0; tick < 3; tick++ {
			p.advance()
		}
		return false
	})
	// Let the native mission draw and process its opening text and radar markers.
	for i := 0; i < 50; i++ {
		p.advance()
	}
	frame := p.screenshot()
	colored := 0
	for y := 100; y < 480; y++ {
		for x := 80; x < 600; x++ {
			r, g, b, _ := frame.At(x, y).RGBA()
			if r > 10000 || g > 10000 || b > 10000 {
				colored++
			}
		}
	}
	if colored < 10000 {
		t.Fatalf("mission terrain did not render: %d pixels", colored)
	}
	// Provision the hotel with one of the starting engineers. Civilians must
	// physically traverse the mission before relay destruction can win.
	p.click(269, 104)
	p.click(200, 110)
	for i := 0; i < 100; i++ {
		p.advance()
	}
	// Select the strike force and destroy the power plant. This is a native
	// attack order: victory now requires combat, not entering tagged cells.
	p.mouse(265, 130, "mousePressed", 1)
	for i := 1; i <= 10; i++ {
		p.mouse(265+i*14, 130+i*12, "mouseMoved", 1)
		p.advance()
	}
	p.mouse(405, 250, "mouseReleased", 0)
	p.advance()
	p.click(465, 270)
	for i := 0; i < 180; i++ {
		p.advance()
	}
	if data, err := driver.Screenshot(); err == nil {
		if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
			_ = os.WriteFile(filepath.Join(dir, "bio-power-breach.png"), data, 0644)
		}
	}
	p.click(410, 535)
	p.wait("evacuating civilians and destroying the relay advances to Hack Fortress", func() bool {
		logs := p.logs()
		if strings.Contains(logs, "message.rml shown") {
			t.Fatal("evacuation operation failed")
		}
		return strings.Contains(logs, "Reading scenario: BIO02.INI")
	})
	p.wait("defense briefing", func() bool { return strings.Count(p.logs(), "restate.rml shown") >= 2 })
	p.wait("defense briefing dismissed", func() bool {
		if strings.Count(p.logs(), "restate.rml closed") >= 2 {
			return true
		}
		if err := canvas.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 3; i++ {
			p.advance()
		}
		return false
	})
	p.click(293, 140) // Engineer outside the construction yard.
	p.click(70, 350)  // Capture the southern hacking terminal.
	for i := 0; i < 100; i++ {
		p.advance()
	}
	if data, err := driver.Screenshot(); err == nil {
		if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
			_ = os.WriteFile(filepath.Join(dir, "bio-defense-base.png"), data, 0644)
		}
	}
	// Observe the ordinary credit display: with no production orders or other
	// income, a change proves the harvester can collect and deliver Tiberium.
	creditFrame := p.screenshot()
	creditChanged := func() bool {
		frame := p.screenshot()
		changed := 0
		for y := 3; y < 14; y++ {
			for x := 680; x < 780; x++ {
				r, g, b, _ := frame.At(x, y).RGBA()
				br, bg, bb, _ := creditFrame.At(x, y).RGBA()
				if (r > 50000 && g > 50000 && b > 20000) != (br > 50000 && bg > 50000 && bb > 20000) {
					changed++
				}
			}
		}
		return changed > 15
	}
	p.wait("harvested Tiberium increases available credits", func() bool {
		if strings.Contains(p.logs(), "Reading scenario: BIO03.INI") {
			t.Fatal("no harvesting income before the defense ended")
		}
		return creditChanged()
	})
	p.click(775, 552) // Scroll past the harvester to the Titan cameo.
	for i := 0; i < 4; i++ {
		p.click(760, 515)
	} // Queue armor for the incoming waves.
	p.wait("capturing the terminal and defending the uplink advances to Full Steam Ahead", func() bool {
		logs := p.logs()
		if strings.Contains(logs, "message.rml shown") {
			t.Fatal("capture-and-defense operation failed")
		}
		return strings.Contains(logs, "Reading scenario: BIO03.INI")
	})

	p.wait("siege briefing", func() bool { return strings.Count(p.logs(), "restate.rml shown") >= 3 })
	p.wait("siege briefing dismissed", func() bool {
		if strings.Count(p.logs(), "restate.rml closed") >= 3 {
			return true
		}
		if err := canvas.SendKeys(selenium.EnterKey); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 3; i++ {
			p.advance()
		}
		return false
	})
	for i := 0; i < 50; i++ {
		p.advance()
	}
	p.click(775, 552) // Scroll the siege factory list to the Titan.
	p.mouse(760, 515, "mouseMoved", 0)
	for i := 0; i < 3; i++ {
		p.advance()
	}
	factoryFrame := p.screenshot()
	p.click(760, 515) // Build a Titan through the native factory sidebar.
	for i := 0; i < 10; i++ {
		p.advance()
	}
	buildingFrame := p.screenshot()
	changed := 0
	for y := 498; y < 530; y++ {
		for x := 732; x < 787; x++ {
			if factoryFrame.At(x, y) != buildingFrame.At(x, y) {
				changed++
			}
		}
	}
	if changed < 50 {
		t.Fatal("Titan production did not update the factory sidebar")
	}
	for i := 0; i < 100; i++ {
		p.advance()
	}
	// Clear the rail corridor before risking the evidence train. Its arrival,
	// rather than base annihilation or a timer, must advance this chapter.
	p.mouse(265, 130, "mousePressed", 1)
	for i := 1; i <= 10; i++ {
		p.mouse(265+i*21, 130+i*10, "mouseMoved", 1)
		p.advance()
	}
	p.mouse(475, 230, "mouseReleased", 0)
	p.advance()
	p.click(465, 270)
	for i := 0; i < 220; i++ {
		p.advance()
	}
	if strings.Contains(p.logs(), "Reading scenario: BIO04.INI") {
		t.Fatal("rail mission won before releasing the train")
	}
	p.click(410, 535)
	p.wait("delivering the train advances to Westbound", func() bool {
		logs := p.logs()
		if strings.Contains(logs, "message.rml shown") {
			t.Fatal("evidence train was lost")
		}
		return strings.Contains(logs, "Reading scenario: BIO04.INI")
	})

	// Continue through the wilderness rescue, quarantine takeover and final
	// two-terminal lockdown using ordinary orders and mission briefings.
	resume := func(chapter int) {
		p.wait("next chapter briefing", func() bool { return strings.Count(p.logs(), "restate.rml shown") >= chapter })
		p.wait("dismiss next chapter briefing", func() bool {
			if strings.Count(p.logs(), "restate.rml closed") >= chapter {
				return true
			}
			if err := canvas.SendKeys(selenium.EnterKey); err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 3; i++ {
				p.advance()
			}
			return false
		})
		for i := 0; i < 50; i++ {
			p.advance()
		}
	}
	march := func(x1, y1, x2, y2 int) {
		p.mouse(x1, y1, "mousePressed", 1)
		for i := 1; i <= 10; i++ {
			p.mouse(x1+(x2-x1)*i/10, y1+(y2-y1)*i/10, "mouseMoved", 1)
			p.advance()
		}
		p.mouse(x2, y2, "mouseReleased", 0)
		p.advance()
	}
	tick := func(count int) {
		for i := 0; i < count; i++ {
			p.advance()
		}
	}
	save := func(name string) {
		if data, err := driver.Screenshot(); err == nil {
			if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
				_ = os.WriteFile(filepath.Join(dir, name), data, 0644)
			}
		}
	}
	next := func(name string) {
		p.wait("complete "+name, func() bool {
			logs := p.logs()
			if strings.Contains(logs, "message.rml shown") {
				t.Fatal("mission failed before " + name)
			}
			return strings.Contains(logs, "Reading scenario: "+name)
		})
	}
	resume(4)
	save("bio-westbound.png")
	march(265, 130, 405, 250)
	p.click(465, 270)
	tick(220)
	p.click(80, 365) // Contact the waystation and release the convoy.
	tick(180)
	p.click(410, 535)
	next("BIO05.INI")
	resume(5)
	p.click(293, 140)
	p.click(70, 350)
	tick(100)
	p.click(775, 552)
	for i := 0; i < 4; i++ {
		p.click(760, 515)
	}
	tick(150)
	save("bio-quarantine.png")
	// Capturing the laser towers must not overload the starting power grid.
	// The native radar switches to a faction logo on low power.
	radar := p.screenshot()
	green := 0
	for y := 30; y < 130; y++ {
		for x := 660; x < 780; x++ {
			r, g, b, _ := radar.At(x, y).RGBA()
			if g > 15000 && g > r*6/5 && g > b*6/5 {
				green++
			}
		}
	}
	if green < 80 {
		t.Fatalf("quarantine takeover left the radar without power: %d map pixels", green)
	}
	next("BIO06.INI")
	resume(6)
	p.click(293, 140)
	p.click(70, 350)          // Southern outbound gateway.
	march(310, 130, 475, 230) // Keep the second engineer out of the assault group.
	p.click(465, 270)
	tick(220)
	p.click(269, 152)
	p.click(584, 380) // Eastern outbound gateway.
	tick(200)
	save("bio-lockdown.png")
	march(300, 150, 500, 350)
	p.click(410, 535)
	p.wait("all six operations completed", func() bool {
		logs := p.logs()
		if strings.Contains(logs, "message.rml shown") {
			t.Fatal("final lockdown operation failed")
		}
		return strings.Count(logs, "BorrowedTime == 90") >= 6
	})
	tick(150)
	if err := canvas.SendKeys(selenium.EscapeKey); err != nil {
		t.Fatal(err)
	} // Native end credits.
	p.wait("return to the main menu after the finale", func() bool {
		if strings.Contains(p.logs(), "message.rml shown") {
			t.Fatal("finale ended in defeat")
		}
		p.mouse(400, 408, "mouseMoved", 0)
		return p.white(400, 408)
	})
	p.click(400, 260)
	p.wait("campaign can be replayed after completion", func() bool { return strings.Count(p.logs(), "campaign.rml opened") >= 2 })

}
