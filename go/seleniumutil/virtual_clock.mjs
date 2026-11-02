import { withGlobal } from '@sinonjs/fake-timers';

// Asyncify continuations need native promise turns between timer callbacks.
// MessageChannel supplies those turns without setTimeout's real-time clamp.
const channel = new MessageChannel();
const pending = [];
channel.port1.onmessage = () => pending.shift()?.();
let taskID = 0;
const enqueue = callback => { pending.push(callback); channel.port2.postMessage(null); return ++taskID; };
const nativeTimeout = globalThis.setTimeout;
let fakeTimers;
try {
    globalThis.setTimeout = enqueue;
    fakeTimers = withGlobal(globalThis);
} finally {
    globalThis.setTimeout = nativeTimeout;
}

// This bundle is embedded in browser tests only, never in the website.
// The library exposes its controller as setTimeout.clock; no game API is added.
fakeTimers.install({
    // Match server-rendered calendar text, then keep the clock frozen.
    now: Date.now(),
    shouldAdvanceTime: false,
    toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
});

// Emscripten stores browser timer handles in 32-bit integers. Sinon deliberately
// starts its handles above that range, so expose browser-sized IDs to Wasm.
const timers = new Map();
let nextHandle = 0;
const wrap = (schedule, cancel, repeating = false) => {
    const wrapped = (callback, ...args) => {
        do { nextHandle = nextHandle % 2147483647 + 1; } while (timers.has(nextHandle));
        const id = nextHandle;
        const handle = schedule((...values) => {
            if (!repeating) timers.delete(id);
            callback(...values);
        }, ...args);
        timers.set(id, { handle, cancel });
        return id;
    };
    wrapped.clock = schedule.clock;
    return wrapped;
};
const cancel = id => {
    const timer = timers.get(id);
    if (timer) { timer.cancel(timer.handle); timers.delete(id); }
};
globalThis.setTimeout = wrap(setTimeout, clearTimeout);
globalThis.setInterval = wrap(setInterval, clearInterval, true);
globalThis.requestAnimationFrame = wrap(requestAnimationFrame, cancelAnimationFrame);
globalThis.clearTimeout = cancel;
globalThis.clearInterval = cancel;
globalThis.cancelAnimationFrame = cancel;
