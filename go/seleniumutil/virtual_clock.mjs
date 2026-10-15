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

// Movie transitions follow consumed audio samples, not just performance.now.
// Drive ScriptProcessor callbacks from the same clock so the real Wasm mixer
// consumes PCM without depending on a physical audio device's clock.
const NativeAudioContext = globalThis.AudioContext;
class ClockedAudioContext extends NativeAudioContext {
    #state = 'suspended';
    #elapsed = 0;
    #started = 0;
    #nodes = new Set();
    get state() { return this.#state; }
    get currentTime() { return (this.#elapsed + (this.#state === 'running' ? performance.now() - this.#started : 0)) / 1000; }
    resume() {
        if (this.#state === 'suspended') { this.#started = performance.now(); this.#state = 'running'; }
        return Promise.resolve();
    }
    suspend() {
        if (this.#state === 'running') { this.#elapsed += performance.now() - this.#started; this.#state = 'suspended'; }
        return Promise.resolve();
    }
    close() {
        this.suspend();
        this.#state = 'closed';
        for (const node of this.#nodes) node.disconnect();
        return super.close();
    }
    createScriptProcessor(frames, inputs, outputs) {
        const context = this;
        const inputBuffer = this.createBuffer(Math.max(inputs, 1), frames, this.sampleRate);
        const outputBuffer = this.createBuffer(Math.max(outputs, 1), frames, this.sampleRate);
        const period = frames / this.sampleRate * 1000;
        let timer;
        let connected = false;
        let deadline;
        const process = () => {
            if (!connected) return;
            if (context.state === 'running') {
                node.onaudioprocess?.({inputBuffer, outputBuffer, playbackTime: context.currentTime});
            }
            if (!connected) return;
            deadline += period;
            timer = setTimeout(process, Math.max(1, Math.ceil(deadline - performance.now())));
        };
        const node = {
            onaudioprocess: null,
            connect(destination) {
                if (!connected) {
                    connected = true;
                    deadline = performance.now() + period;
                    timer = setTimeout(process, Math.ceil(period));
                    context.#nodes.add(node);
                }
                return destination;
            },
            disconnect() { connected = false; clearTimeout(timer); timer = undefined; context.#nodes.delete(node); },
        };
        return node;
    }
}
globalThis.AudioContext = ClockedAudioContext;
