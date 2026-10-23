package selenium

import (
	_ "embed"
	"fmt"
	"time"
)

//go:embed virtual_clock_bundle.js
var virtualClockScript string

// VirtualClock drives test-only replacements for browser dates, performance
// timers, timeouts, intervals, animation frames, and Web Audio processing/completion
// callbacks. Emscripten shares those clocks, so advancing runs the real WebAssembly engine without wall-clock
// sleeps. Network requests, rendering, and CPU work still take real time.
type VirtualClock struct{ driver *Driver }

// NewVirtualClock installs the clock before application scripts on each future
// document. Navigate after installation; WebDriver should use pageLoadStrategy
// "eager" so loading waits for the document, without waiting for application
// timers that are now paused.
func NewVirtualClock(driver *Driver) (*VirtualClock, error) {
	if err := driver.ExecuteChromiumCommand("Page.addScriptToEvaluateOnNewDocument", map[string]any{"source": virtualClockScript}); err != nil {
		return nil, err
	}
	return &VirtualClock{driver: driver}, nil
}

// Advance runs scheduled browser work and promise continuations for a virtual
// duration, leaving time frozen between steps. Navigation ends the current
// document's advance early; external work still uses native browser tasks.
func (clock *VirtualClock) Advance(duration time.Duration) error {
	if duration <= 0 {
		return fmt.Errorf("virtual duration must be positive")
	}
	// Chrome can discard the async WebDriver callback during document navigation,
	// even when pagehide calls it. Only forgive that error if the document changed.
	origin, err := clock.driver.ExecuteScript("return performance.timeOrigin", nil)
	if err != nil {
		return err
	}
	result, err := clock.driver.ExecuteScriptAsync(`
        const done = arguments[arguments.length - 1];
        // History may restore a document visited before clock installation.
        if (!setTimeout.clock) { done(null); return; }
        let settled = false;
        const finish = error => {
            if (settled) return;
            settled = true;
            removeEventListener('pagehide', unloading);
            done(error);
        };
        const unloading = () => finish(null);
        addEventListener('pagehide', unloading, {once:true});
        setTimeout.clock.tickAsync(arguments[0]).then(() => finish(null), error => finish(error.stack ?? String(error)));
    `, []interface{}{float64(duration) / float64(time.Millisecond)})
	if err != nil {
		current, navigationErr := clock.driver.ExecuteScript("return performance.timeOrigin", nil)
		if navigationErr == nil && current != origin {
			return nil
		}
		return err
	}
	if result != nil {
		return fmt.Errorf("advance virtual clock: %v", result)
	}
	return nil
}
