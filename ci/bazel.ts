import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runfiles } from '@bazel/runfiles';

import {
	Command,
	FilePositionParams,
} from '#root/ts/github/actions/index.js';

/**
 * Drink bytes from the Readable, returning each line.
 */
async function* byLine(r: NodeJS.ReadableStream) {
	const chunks: (string | Buffer)[] = [];
	for await (const chunk of r) {
		const lines = chunk.toString().split(/\r?\n/g);

		// no newlines occurred.
		// when lines.length == 1, ["something"], no new line must have
		// happened or we would have ["something", ""]
		// lines.length == 0 is impossible afaik.
		// it's probably possible to get an empty chunk, so we filter that out
		// so we're not waiting forever on a new chunk.
		if (lines.length < 2) {
			chunks.push(...lines.filter(v => v.length > 0));
			continue;
		}

		const last = lines.pop();

		// at least one new line must have happened. We can flush the chunks
		// along with all the newlines EXCEPT the last.
		yield* [chunks.join(''), ...lines];

		if (last) chunks.push(last);
	}

	// send any extra stuff that was never newline terminated.
	const text = chunks.join('');
	if (text.length !== 0) yield text;
}

function getWorkspaceRelativePath(path: string): FilePositionParams {
	const m = /([^:]+)(?::(\d+))?(?::(\d+))?/.exec(path);

	if (m === null) return {};

	let [, filePath, line, column] = m;

	const m2 =
		/(?:.*bazel\/_bazel_runner\/[^/]+\/|.*runner\/work\/)(?:monorepo\/)*(.*)/.exec(
			filePath!
		);

	if (m2 !== null) {
		[, filePath] = m2;
	}

	return { file: filePath, line, col: column };
}

/*
function buildTagToBuildFile(buildTag: string): string {
	const m = /^\/\/([^:]+):(.*)/.exec(buildTag);

	if (m === null) return buildTag;

	const [, packagePath] = m;

	return Path.join(packagePath, 'BUILD.bazel');
}
*/

async function* AnnotateDebugStatements(lines: AsyncGenerator<string>) {
	for await (const line of lines) {
		const m = /^\s*DEBUG: ([^ ]+)(?: WARNING: (.*))?/g.exec(line);

		if (m === null) {
			yield line;
			continue;
		}

		const [, filepath, warningMessage] = m;

		if (warningMessage) {
			yield Command('warning')({
				...getWorkspaceRelativePath(filepath!),
				title: warningMessage,
			})(line);
			continue;
		}

		yield Command('debug')(getWorkspaceRelativePath(filepath!))(line);
	}
}

async function* AnnotateNonCacheWarnings(lines: AsyncGenerator<string>) {
	for await (const line of lines) {
		const m =
			/\s+WARNING: Fetching from [^\s]+ without an integrity hash. The result will not be cached/g.exec(
				line
			);

		if (m === null) {
			yield line;
			continue;
		}

		yield Command('error')({
			file: 'MODULE.bazel',
		})(line);
	}
}

async function* AnnotateBazelFailures(lines: AsyncGenerator<string>) {
	for await (const line of lines) {
		const m = /ERROR:(\s+[^:]+.bazel:\d+:\d+):\s+.*/.exec(line);

		if (m === null) {
			yield line;
			continue;
		}

		const [, filepath] = m;

		yield Command('error')({
			...getWorkspaceRelativePath(filepath!),
		})(line);
	}
}

export function AnnotateBazelLines(lines: AsyncGenerator<string>) {
	return AnnotateBazelFailures(
		AnnotateNonCacheWarnings(AnnotateDebugStatements(lines))
	);
}

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
		AnnotateBazelLines(byLine(bazel.stdout)),
		AnnotateBazelLines(byLine(bazel.stderr))
	)) {
		if (!errorObserved && /^::error/.test(line)) errorObserved = true;
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
