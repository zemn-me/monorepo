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
console.log('entry', entry, 'build_target', build_target);

//throw new Error(`next, ${next} files ${files} cwd ${process.cwd()}, bin ${process.env.BAZEL_BINDIR}`);
//throw new Error(spawnSync('ls', ['../../../../../external']).output.toString())


const args = process.argv
	.slice(2)
	.concat(['build', '--debug', build_target ]);

const spawnOptions = {
	shell: process.env.SHELL,
	stdio: 'inherit',
};

const res = spawnSync(entry, args, spawnOptions as any);
if (res.status === null) {
	// Process can fail with a null exit-code (e.g. OOM), handle appropriately
	throw new Error(`Process terminated unexpectedly: ${res.signal}`);
}


//fs.renameSync(build_target + '/build', './ts/next.js/example/build')
console.error(spawnSync('ls',[ build_target], { stdio: 'inherit' }).output.toString());
console.error('cwd', process.cwd());
fs.renameSync(build_target + '/build', process.env.OUT!);


process.exit(res.status);