// SPDX-License-Identifier: GPL-3.0-or-later
const launch = document.querySelector('#launch');
const selection = document.querySelector('#files');
const status = document.querySelector('#status');
const canvas = document.querySelector('#canvas');
const log = document.querySelector('#log');
const script = document.querySelector('script[data-engine]');
const extensions = /\.(mix|ini|map|mpr|vqa|aud|pal|shp|vxl|hva|tmp|fnt|pcx)$/i;
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

function gamePath(file) {
    return file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
}

function selectedFiles() {
    return Array.from(selection.files).filter(file => extensions.test(file.name));
}

selection.addEventListener('change', () => {
    const files = selectedFiles();
    launch.disabled = !files.some(file => gamePath(file).toUpperCase() === 'TIBSUN.MIX');
    status.textContent = launch.disabled
        ? 'Choose the installed game folder containing TIBSUN.MIX.'
        : `${files.length} game files selected.`;
});

launch.addEventListener('click', async () => {
    const files = selectedFiles();
    if (!files.some(file => gamePath(file).toUpperCase() === 'TIBSUN.MIX')) return;
    launch.disabled = true;
    selection.disabled = true;
    status.textContent = 'Loading the game engine…';
    try {
        const { default: createEngine } = await import(script.dataset.engine);
        const engine = await createEngine({
            canvas,
            noInitialRun: true,
            locateFile: name => name.endsWith('.wasm') ? script.dataset.wasm : script.dataset.data,
            print: record,
            printErr: record,
            onAbort: message => { status.textContent = `The game stopped: ${message}. Reload to try again.`; },
            onExit: () => { status.textContent = 'Game closed. Reload to play again.'; },
        });
        engine.FS.mkdirTree('/game');
        engine.FS.mkdirTree('/save');
        engine.FS.mount(engine.IDBFS, { autoPersist: true }, '/save');
        await new Promise((resolve, reject) => engine.FS.syncfs(true, error => error ? reject(error) : resolve()));
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            status.textContent = `Loading game files: ${index + 1} of ${files.length}…`;
            const relative = gamePath(file);
            const parts = relative.split('/');
            if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid file path');
            const path = '/game/' + parts.join('/');
            engine.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
            engine.FS.writeFile(path, new Uint8Array(await file.arrayBuffer()));
        }
        if (!engine.FS.analyzePath('/save/SUN.INI').exists) {
            engine.FS.writeFile('/save/SUN.INI', '[Video]\nScreenWidth=800\nScreenHeight=600\nWindowed=yes\n[Options]\nVideoBackBuffer=no\n');
        }
        engine.FS.chdir('/game');
        status.textContent = 'Game running. Saves are kept in this browser.';
        canvas.hidden = false;
        document.querySelector('#fullscreen').disabled = false;
        canvas.focus();
        engine.callMain(['-DATADIR=/game', '-USERDIR=/save', '-WIN']);
    } catch (error) {
        record(error);
        status.textContent = `Could not start the game: ${error.message ?? error}. Reload to try again.`;
    }
});

document.querySelector('#fullscreen').addEventListener('click', () => {
    canvas.requestFullscreen().catch(record);
});
