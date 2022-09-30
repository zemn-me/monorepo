import { runfiles } from '@bazel/runfiles';
import { spawnSync } from 'child_process';

const entry = require.resolve(runfiles.resolve('npm/next/bin/next.sh'));

const args = process.argv
	.slice(2)
	.concat(['build', runfiles.resolve('monorepo/ts/next.js/testing/example')]);

const spawnOptions = {
	shell: process.env.SHELL,
	stdio: [process.stdin, 'ignore', process.stderr],
};

const res = spawnSync(entry, args, spawnOptions as any);
if (res.status === null) {
	// Process can fail with a null exit-code (e.g. OOM), handle appropriately
	throw new Error(`Process terminated unexpectedly: ${res.signal}`);
}

process.exit(res.status);
