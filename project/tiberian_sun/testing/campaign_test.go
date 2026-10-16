package testing_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
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
	if err := driver.Get("http://localhost:" + ports.Site + "/experiments/tiberian-sun/bio"); err != nil {
		t.Fatal(err)
	}
	for _, width := range []int{1100, 390} {
		if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": width, "height": 850, "deviceScaleFactor": 1, "mobile": false}); err != nil {
			t.Fatal(err)
		}
		buttons, err := driver.FindElements(selenium.ByCSSSelector, "nav[aria-label='Campaign missions'] button")
		if err != nil || len(buttons) != 4 {
			t.Fatalf("mission selection: %d buttons: %v", len(buttons), err)
		}
		for index, button := range buttons {
			if err := button.Click(); err != nil {
				t.Fatal(err)
			}
			p.wait("selected mission dossier", func() bool {
				pressed, _ := button.GetAttribute("aria-pressed")
				records, _ := driver.FindElements(selenium.ByCSSSelector, "section[aria-label='Mission dossier'] li")
				return pressed == "true" && len(records) > 0
			})
			if index == 0 {
				// Keyboard focus must be visible; the dossier must fit phone widths.
				if err := button.SendKeys(selenium.TabKey); err != nil {
					t.Fatal(err)
				}
				fits, err := driver.ExecuteScript("return document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.activeElement).outlineStyle !== 'none'", nil)
				if err != nil || fits != true {
					t.Fatalf("campaign layout/focus at %d: %v %v", width, fits, err)
				}
				if data, err := driver.Screenshot(); err == nil {
					if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
						_ = os.WriteFile(filepath.Join(dir, "bio-dossier-"+strconv.Itoa(width)+".png"), data, 0644)
					}
				}
			}
		}
	}
	if err := driver.ExecuteChromiumCommand("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 600, "deviceScaleFactor": 1, "mobile": false}); err != nil {
		t.Fatal(err)
	}
	buttons, _ := driver.FindElements(selenium.ByCSSSelector, "nav[aria-label='Campaign missions'] button")
	if err := buttons[0].Click(); err != nil {
		t.Fatal(err)
	}
	launch, err := driver.FindElement(selenium.ByXPATH, "//button[contains(., 'Deploy expedition')]")
	if err != nil {
		t.Fatal(err)
	}
	if err := launch.Click(); err != nil {
		t.Fatal(err)
	}
	p.wait("native bio scenario starts", func() bool {
		text := p.logs()
		if strings.Contains(text, "Could not") || strings.Contains(text, "RuntimeError") || strings.Contains(text, "Unable to read scenario") {
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
	// Box-select the expedition, then issue native move orders beside the
	// visible huts. Recovering the third archive must load the next mission.
	p.mouse(270, 95, "mouseMoved", 0)
	p.mouse(270, 95, "mousePressed", 1)
	for i := 1; i <= 10; i++ {
		p.mouse(270+i*10, 95+i*8, "mouseMoved", 1)
		p.advance()
	}
	p.mouse(370, 175, "mouseReleased", 0)
	p.advance()
	p.click(438, 228)
	for i := 0; i < 100; i++ {
		p.advance()
	}
	if data, err := driver.Screenshot(); err == nil {
		if dir := os.Getenv("TEST_UNDECLARED_OUTPUTS_DIR"); dir != "" {
			_ = os.WriteFile(filepath.Join(dir, "bio-first-recovery.png"), data, 0644)
		}
	}
	p.click(390, 490)
	for i := 0; i < 150; i++ {
		p.advance()
	}
	p.click(674, 88) // Send the selected expedition to the western archive through the radar.
	p.wait("all three archives advance to mission two", func() bool {
		return strings.Contains(p.logs(), "Reading scenario: BIO02.INI")
	})

}
