import { runfiles } from '@bazel/runfiles';
import { spawnSync } from 'child_process';
import * as fs from 'fs';




const entry = require.resolve(`next/dist/bin/next`);
const build_target = runfiles.resolveWorkspaceRelative('ts/next.js/testing/example');



const args = process.argv
	.slice(2);

const spawnOptions = {
	shell: process.env.SHELL,
	stdio: 'inherit',
};

const res1 = spawnSync(entry, args.concat(['build', build_target]), spawnOptions as any);
if (res1.status === null) {
	// Process can fail with a null exit-code (e.g. OOM), handle appropriately
	throw new Error(`Process terminated unexpectedly: ${res1.signal}`);
}
const res2 = spawnSync(entry, args.concat(['export', build_target]), spawnOptions as any);
if (res2.status === null) {
	// Process can fail with a null exit-code (e.g. OOM), handle appropriately
	throw new Error(`Process terminated unexpectedly: ${res2.signal}`);
}

fs.renameSync(build_target + '/out', process.env.OUT!);


process.exit(res1.status || res2.status);