import { runfiles } from '@bazel/runfiles';
import { spawnSync } from 'child_process';
import * as fs from 'fs';

const dir = process.env.PACKAGE_NAME!;
const base = process.env.BAZEL_BINDIR!;
//const entry = `node_modules/next/dist/bin/next`;
const entry = `bazel-out/k8-fastbuild/bin/external/npm/node_modules/next/dist/bin/next`;
const build_target = `bazel-out/k8-fastbuild/bin/${dir}`;




async function main() {
	console.error('bindir', process.env.BAZEL_BINDIR!, 'srcs', process.env.SRCS!);
	console.error('entry', entry, 'build_target', build_target);
	console.error(spawnSync('ls', [ 'node_modules/monorepo/ts/next.js/testing/example' ]).output.toString())
	const args = process.argv
		.slice(2);

	const spawnOptions = {
		shell: process.env.SHELL,
		stdio: 'inherit',
	};

	const res1 = spawnSync(entry, args.concat(['build', build_target]), spawnOptions as any);
	if (res1.error != undefined) throw res1.error;
	if (res1.status === null) {
		// Process can fail with a null exit-code (e.g. OOM), handle appropriately
		throw new Error(`Process terminated unexpectedly: ${res1.signal}`);
	}
	const res2 = spawnSync(entry, args.concat(['export', build_target]), spawnOptions as any);
	if (res2.error !== undefined) throw res2.error;
	if (res2.status === null) {
		// Process can fail with a null exit-code (e.g. OOM), handle appropriately
		throw new Error(`Process terminated unexpectedly: ${res2.signal}`);
	}

	fs.renameSync(build_target + '/out', process.env.OUT!);


	process.exit(res1.status || res2.status);
}



main();