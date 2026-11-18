package selenium_test

import (
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
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

func TestVirtualClockHistoryNavigation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		if r.URL.Path == "/game" {
			// Navigation can destroy WebDriver's callback before pagehide completes.
			// An earlier pagehide handler makes that ordering deterministic here.
			fmt.Fprint(w, `<script>
addEventListener('pagehide', e => e.stopImmediatePropagation());
setInterval(() => {}, 1);
setTimeout(() => history.back(), 10);
</script>`)
			return
		}
		fmt.Fprint(w, `<p>Previous document</p>`)
	}))
	defer server.Close()
	driver, err := selenium.NewWithChromeCapabilities(webdriver.Capabilities{"pageLoadStrategy": "eager"})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	if err := driver.SetAsyncScriptTimeout(2 * time.Second); err != nil {
		t.Fatal(err)
	}
	// The previous document predates clock installation, just like the game's Exit.
	if err := driver.Get(server.URL + "/before"); err != nil {
		t.Fatal(err)
	}
	clock, err := selenium.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	if err := driver.Get(server.URL + "/game"); err != nil {
		t.Fatal(err)
	}
	if err := clock.Advance(time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := driver.WaitWithTimeout(func(w webdriver.WebDriver) (bool, error) {
		url, err := w.CurrentURL()
		return url == server.URL+"/before", err
	}, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	if err := clock.Advance(100 * time.Millisecond); err != nil {
		t.Fatal(err)
	}
}

func TestVirtualBufferedAudio(t *testing.T) {
	driver, err := selenium.NewWithChromeCapabilities(webdriver.Capabilities{"pageLoadStrategy": "eager"})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	clock, err := selenium.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	html := `<button id="start">Play</button><output id="events"></output><button id="pause">Pause</button><button id="resume">Resume</button><button id="stop">Stop loop</button><script>
document.querySelector('#start').onclick=()=>{
const context=new AudioContext({sampleRate:48000}),events=document.querySelector('#events');
const buffer=context.createBuffer(1,96000,48000);
const short=context.createBufferSource();short.buffer=buffer;short.playbackRate.value=2;
short.onended=()=>events.textContent+='short ';short.connect(context.destination);short.start(1,0.5,1);
const loop=context.createBufferSource();loop.buffer=buffer;loop.loop=true;
loop.addEventListener('ended',()=>events.textContent+='loop ');loop.connect(context.destination);loop.start();
document.querySelector('#pause').onclick=()=>context.suspend();
document.querySelector('#resume').onclick=()=>context.resume();
document.querySelector('#stop').onclick=()=>loop.stop(context.currentTime+0.5);
};
</script>`
	if err := driver.Get("data:text/html," + url.PathEscape(html)); err != nil {
		t.Fatal(err)
	}
	play, err := driver.FindElement(webdriver.ByCSSSelector, "#start")
	if err != nil {
		t.Fatal(err)
	}
	if err := play.Click(); err != nil {
		t.Fatal(err)
	}
	advance := func(duration time.Duration) {
		t.Helper()
		if err := clock.Advance(duration); err != nil {
			t.Fatal(err)
		}
	}
	click := func(id string) {
		t.Helper()
		if _, err := driver.ExecuteScript("document.getElementById(arguments[0]).click()", []interface{}{id}); err != nil {
			t.Fatal(err)
		}
	}
	assertEvents := func(want string) {
		t.Helper()
		got, err := driver.ExecuteScript("return document.querySelector('#events').textContent", nil)
		if err != nil || got != want {
			t.Fatalf("audio completions=%v, want %q: %v", got, want, err)
		}
	}
	advance(500 * time.Millisecond)
	click("pause")
	advance(time.Minute)
	assertEvents("")
	click("resume")
	advance(999 * time.Millisecond)
	assertEvents("")
	advance(time.Millisecond)
	assertEvents("short ")
	advance(time.Minute)
	assertEvents("short ")
	click("stop")
	advance(499 * time.Millisecond)
	assertEvents("short ")
	advance(time.Millisecond)
	assertEvents("short loop ")
}

func TestVirtualClockResourceTiming(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/data" {
			fmt.Fprint(w, "downloaded")
			return
		}
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `<output></output><script>fetch('/data').then(r=>r.text()).then(text=>document.querySelector('output').textContent=text)</script>`)
	}))
	defer server.Close()
	driver, err := selenium.NewWithChromeCapabilities(webdriver.Capabilities{"pageLoadStrategy": "eager"})
	if err != nil {
		t.Fatal(err)
	}
	defer driver.Close()
	clock, err := selenium.NewVirtualClock(driver)
	if err != nil {
		t.Fatal(err)
	}
	if err := driver.Get(server.URL); err != nil {
		t.Fatal(err)
	}
	const resource = `return performance.getEntriesByType('resource').some(e=>e.name.endsWith('/data') && e.encodedBodySize>0)`
	if err := driver.WaitWithTimeout(func(w webdriver.WebDriver) (bool, error) {
		value, err := w.ExecuteScript(resource, nil)
		return value == true, err
	}, 5*time.Second); err != nil {
		t.Fatalf("native network entries unavailable under virtual time: %v", err)
	}
	if err := clock.Advance(time.Minute); err != nil {
		t.Fatal(err)
	}
	if value, err := driver.ExecuteScript(resource, nil); err != nil || value != true {
		t.Fatalf("advancing virtual time lost the download entry: %v, %v", value, err)
	}
}
