import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({
    entryPoints: [fileURLToPath(new URL('./virtual_clock_entry.js', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    // Optional Node helpers are guarded by process detection or try/catch.
    external: ['util', 'timers', 'timers/promises'],
});
process.stdout.write(result.outputFiles[0].text);
