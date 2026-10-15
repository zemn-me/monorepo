// SPDX-License-Identifier: GPL-3.0-or-later
const launch = document.querySelector('#launch');
const status = document.querySelector('#status');
const canvas = document.querySelector('#canvas');
const progress = document.querySelector('#progress');
const log = document.querySelector('#log');
const script = document.querySelector('script[data-engine]');
const lines = [];

function record(message) {
    lines.push(String(message));
    if (lines.length > 200) lines.shift();
    log.textContent = lines.join('\n');
}

window.addEventListener('error', event => {
    record(event.error?.stack ?? event.message);
    status.textContent = 'The game stopped unexpectedly. Open the game log for details. Reload to try again.';
});

async function downloadGame() {
    const response = await fetch(script.dataset.game);
    if (!response.ok) throw new Error(`Game download failed (${response.status})`);
    const total = Number(response.headers.get('content-length'));
    progress.hidden = false;
    progress.removeAttribute('value');
    if (total > 0) { progress.max = total; progress.value = 0; }
    let received = 0;
    const measured = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
            received += chunk.byteLength;
            if (total > 0) progress.value = received;
            controller.enqueue(chunk);
        },
    }));
    const data = new Uint8Array(await new Response(measured.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    progress.hidden = true;
    return data;
}

function importGame(engine, data) {
    if (data.length < 12 || new TextDecoder().decode(data.subarray(0, 8)) !== 'OPENTSD1') throw new Error('Invalid game package');
    const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(8, true);
    if (length > data.length - 12) throw new Error('Incomplete game package');
    const files = JSON.parse(new TextDecoder().decode(data.subarray(12, 12 + length)));
    let offset = 12 + length;
    const names = new Set();
    for (const { name, size } of files) {
        if (!/^[A-Z0-9_]+\.(MIX|MAP)$/.test(name) || /^(SCORES|MOVIES)/.test(name) || names.has(name) || !Number.isSafeInteger(size) || size <= 0 || size > data.length - offset) throw new Error('Invalid game file');
        names.add(name);
        engine.FS.writeFile('/game/' + name, data.subarray(offset, offset + size), { canOwn: true });
        offset += size;
    }
    if (offset !== data.length || !names.has('TIBSUN.MIX')) throw new Error('Incomplete game package');
}

launch.addEventListener('click', async () => {
    launch.disabled = true;
    status.textContent = 'Loading the game engine and downloading game files…';
    try {
        const { default: createEngine } = await import(script.dataset.engine);
        const [engine, data] = await Promise.all([createEngine({
            canvas,
            noInitialRun: true,
            locateFile: name => name.endsWith('.wasm') ? script.dataset.wasm : script.dataset.data,
            print: record,
            printErr: record,
            onAbort: message => { status.textContent = `The game stopped: ${message}. Reload to try again.`; },
            onExit: () => { status.textContent = 'Game closed. Reload to play again.'; },
        }), downloadGame()]);
        engine.FS.mkdirTree('/game');
        engine.FS.mkdirTree('/save');
        engine.FS.mount(engine.IDBFS, { autoPersist: true }, '/save');
        await new Promise((resolve, reject) => engine.FS.syncfs(true, error => error ? reject(error) : resolve()));
        importGame(engine, data);
        if (!engine.FS.analyzePath('/save/SUN.INI').exists) {
            engine.FS.writeFile('/save/SUN.INI', '[Video]\nScreenWidth=800\nScreenHeight=600\nWindowed=yes\n[Options]\nVideoBackBuffer=no\n');
        }
        engine.FS.chdir('/game');
        status.textContent = 'Game running. Saves are kept in this browser.';
        canvas.hidden = false;
        document.querySelector('#fullscreen').disabled = false;
        canvas.focus();
        engine.callMain(['-DATADIR=/game', '-USERDIR=/save', '-WIN', '-XCC']);
    } catch (error) {
        progress.hidden = true;
        record(error);
        status.textContent = `Could not start the game: ${error.message ?? error}. Reload to try again.`;
    }
});

document.querySelector('#fullscreen').addEventListener('click', () => {
    canvas.requestFullscreen().catch(record);
});
