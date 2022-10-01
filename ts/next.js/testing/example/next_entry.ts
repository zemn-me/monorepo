import { runfiles } from '@bazel/runfiles';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';



const { spawn } = require('child_process')
//const entry = 'node_modules/next/dist/bin/next';



//const next = runfiles.resolve('npm/next/bin/next.sh');
const files = runfiles.resolve('monorepo/ts/next.js/testing/example');
const entry = require.resolve(`next/dist/bin/next`);
const build_target = runfiles.resolveWorkspaceRelative('ts/next.js/testing/example');

console.info("build target", build_target);

//throw new Error(`next, ${next} files ${files} cwd ${process.cwd()}, bin ${process.env.BAZEL_BINDIR}`);
//throw new Error(spawnSync('ls', ['../../../../../external']).output.toString())

const args = process.argv
	.slice(2)
	.concat(['dev', build_target ]);

const spawnOptions = {
	shell: process.env.SHELL,
	stdio: 'inherit',
};

const res = spawnSync(entry, args, spawnOptions as any);
if (res.status === null) {
	// Process can fail with a null exit-code (e.g. OOM), handle appropriately
	throw new Error(`Process terminated unexpectedly: ${res.signal}`);
}

//spawnSync('sh',[], { stdio: 'inherit' })
process.exit(res.status);