import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({
    entryPoints: [fileURLToPath(new URL('./network_benchmark.js', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'networkBenchmark',
});
process.stdout.write(result.outputFiles[0].text);
