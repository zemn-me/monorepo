import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runfiles } from '@bazel/runfiles';

import { byLine } from '#root/ci/lines/index.js';


/**
 * Interleave the results of two AsyncIterables. Whichever gets there fastest, gets there first.
 */
export async function* interleave<A, B>(
	a: AsyncIterable<A>,
	b: AsyncIterable<B>
): AsyncGenerator<A | B> {
	const its = [a, b].map(v => v[Symbol.asyncIterator]());
	const nexts = its.map((it, i) => it.next().then(res => ({ ...res, i })));

	const dones: (boolean | undefined)[] = its.map(() => false);

	while (!dones.every(v => v)) {
		const res = await Promise.race(nexts.filter((_, i) => !dones[i]));

		// whoever wins the race needs its next promise updated
		nexts[res.i] = its[res.i]!.next().then(v => ({ ...v, i: res.i }));

		yield res.value;

		dones[res.i] = res.done;
	}
}

export async function Bazel(cwd: string, ...args: string[]) {
	const bepDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bazel-bep-'));
	const bepFile = path.join(bepDir, 'build-events.bin');
	const bazel = child_process.spawn(
		'bazelisk',
		[
			...args,
			`--build_event_binary_file=${bepFile}`,
			'--build_event_binary_file_path_conversion=false',
		],
		{ cwd }
	);

	const exitCode = new Promise<number | null>(ok =>
		bazel.on('close', e => ok(e))
	);
	const errors: Error[] = [];
	bazel.addListener('error', e => errors.push(e));
	/**
	 * If a github actions error is observed in any line.
	 */
	let errorObserved = false;

	for await (const line of interleave(
		byLine(bazel.stdout),
		byLine(bazel.stderr)
	)) {
		// biome-ignore lint/suspicious/noConsole: this intentionally writes to the console
		console.log(line);
	}

	try {
		const annotator = runfiles.resolve(
			globalThis.process.env['BAZEL_BEP_ANNOTATOR'] ??
				'monorepo/ci/bazel_bep/bep_annotator_/bep_annotator'
		);
		const annotations = child_process.spawn(annotator, [bepFile], { cwd });

		annotations.addListener('error', e => errors.push(e));

		for await (const line of byLine(annotations.stdout)) {
			if (!errorObserved && /^::error/.test(line)) errorObserved = true;
			// biome-ignore lint/suspicious/noConsole: this intentionally writes to the console
			console.log(line);
		}

		for await (const line of byLine(annotations.stderr)) {
			// biome-ignore lint/suspicious/noConsole: this intentionally writes to the console
			console.error(line);
		}

		const annotationExitCode = await new Promise<number | null>(ok =>
			annotations.on('close', ok)
		);
		if (annotationExitCode !== 0) {
			errors.push(
				new Error(`BEP annotator failed with exit code: ${annotationExitCode}`)
			);
		}
	} catch (e) {
		errors.push(e instanceof Error ? e : new Error(String(e)));
	} finally {
		await fs.rm(bepDir, { force: true, recursive: true });
	}

	if ((await exitCode) !== 0)
		throw new Error(`Bazel failed with exit code: ${bazel.exitCode}`);

	if (errors.length > 0) {
		// biome-ignore lint/suspicious/noConsole: this intentionally writes to the console
		console.info('Failure.');
		throw errors[0];
	}

	if (bazel.exitCode !== 0) {
		throw new Error(`Bazel failed with exit code: ${bazel.exitCode}`);
	}

	if (errorObserved) {
		throw new Error(
			`Bazel exited successfully, but at least one error was observed.`
		);
	}
}
