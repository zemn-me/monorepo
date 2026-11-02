import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const npmCli = join(dirname(require.resolve('npm/package.json')), 'bin/npm-cli.js');
const result = spawnSync(
	process.execPath,
	[npmCli, 'publish', ...process.argv.slice(2)],
	{ stdio: 'inherit' }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
