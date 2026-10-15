package selenium_test

import (
	"math"
	"net/url"
	"testing"
	"time"

	webdriver "github.com/tebeka/selenium"
	selenium "github.com/zemn-me/monorepo/go/seleniumutil"
)

func TestVirtualClock(t *testing.T) {
	driver, err := selenium.NewWithChromeCapabilities(webdriver.Capabilities{"pageLoadStrategy": "eager"})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	clock, err := selenium.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	html := `<output id="ticks">0</output><output id="frames">0</output><output id="audio">0</output><script>
const ticks=document.querySelector('#ticks'), frames=document.querySelector('#frames');
const interval=setInterval(()=>ticks.textContent=Number(ticks.textContent)+1,1000);
if (interval !== (interval|0) || interval <= 0) throw new Error('timer handle does not fit a Wasm integer');
const canceled=setInterval(()=>ticks.textContent=-1000,1);clearInterval(canceled);
const audio=document.querySelector('#audio'), context=new AudioContext({sampleRate:48000});
const processor=context.createScriptProcessor(480,0,1);
processor.onaudioprocess=event=>{audio.textContent=Number(audio.textContent)+1;event.outputBuffer.getChannelData(0).fill(0.25);};
processor.connect(context.destination);context.resume();
function frame(){frames.textContent=Number(frames.textContent)+1;requestAnimationFrame(frame);}requestAnimationFrame(frame);
</script>`
	if err := driver.Get("data:text/html," + url.PathEscape(html)); err != nil {
		t.Fatal(err)
	}
	sample := func() []interface{} {
		t.Helper()
		value, err := driver.ExecuteScript("return [Date.now(),performance.now(),Number(document.querySelector('#ticks').textContent),Number(document.querySelector('#frames').textContent),Number(document.querySelector('#audio').textContent)]", nil)
		if err != nil {
			t.Fatal(err)
		}
		return value.([]interface{})
	}
	if err := clock.Advance(time.Millisecond); err != nil {
		t.Fatal(err)
	}
	before := sample()
	frozen := sample()
	if before[0] != frozen[0] || before[1] != frozen[1] || frozen[2].(float64) != 0 {
		t.Fatalf("clock is not frozen: %v -> %v", before, frozen)
	}
	started := time.Now()
	if err := clock.Advance(time.Minute); err != nil {
		t.Fatal(err)
	}
	after := sample()
	if after[0].(float64)-before[0].(float64) != 60000 || math.Abs(after[1].(float64)-before[1].(float64)-60000) > 1 || after[2].(float64) != 60 || after[3].(float64) != 3750 || after[4].(float64) != 6000 {
		t.Fatalf("virtual minute did not advance clocks and interval callbacks together: %v -> %v", before, after)
	}
	if elapsed := time.Since(started); elapsed >= time.Minute {
		t.Fatalf("virtual minute took %s wall time", elapsed)
	}
	t.Logf("advanced a virtual minute in %s", time.Since(started))
	paused := sample()
	if after[0] != paused[0] || after[1] != paused[1] {
		t.Fatalf("clock did not pause after budget: %v -> %v", after, paused)
	}
}
