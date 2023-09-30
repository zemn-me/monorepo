import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import Path from 'node:path';

import { Command, FilePositionParams } from 'ts/github/actions';

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

	const m2 = /.*bazel\/_bazel_runner\/[^\/]+\/(.*)/.exec(filePath);

	if (m2 !== null) {
		[, filePath] = m2;
	}

	return { file: filePath, line, col: column };
}

function buildTagToBuildFile(buildTag: string): string {
	const m = /^\/\/([^:]+):(.*)/.exec(buildTag);

	if (m === null) return buildTag;

	const [, packagePath] = m;

	return Path.join(packagePath, 'BUILD.bazel');
}

async function* AnnotateTestFailures(lines: AsyncGenerator<string>) {
	for await (const line of lines) {
		const m = /^\s*FAIL: ([^ ]+) \(see ([^ )]+)\)/.exec(line);

		if (m === null) {
			yield line;
			continue;
		}

		const [, tag, logFilePath] = m;

		yield Command('error')({
			file: buildTagToBuildFile(tag),
			title: `${tag} failed.`,
		})((await fs.readFile(logFilePath)).toString());
	}
}

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
				...getWorkspaceRelativePath(filepath),
				title: warningMessage,
			})(line);
			continue;
		}

		yield Command('debug')(getWorkspaceRelativePath(filepath))(line);
	}
}

async function* AnnotateBuildCompletion(lines: AsyncGenerator<string>) {
	const it = lines[Symbol.asyncIterator]();
	for await (const line of it) {
		const m1 = /^\s*INFO: Build completed,.*/.exec(line);

		if (m1 === null) {
			yield line;
			continue;
		}

		yield `${Command('notice')({})(line)}`;

		for await (const line of it) {
			// parse subsequent block of success / failure notices
			const match = /^\s*(\/\/([^:]*):[^ ]+)\s+([^ ]+)/.exec(line);
			console.info(line, match);

			// group 1	//.github:validation                                                     PASSED
			// group 2  .github
			// group 3 PASSED

			if (match === null) {
				yield line;
				break;
			}

			const [, tag, packageName, status] = match;

			const buildFile = packageName + '/BUILD.bazel';

			switch (status) {
				case 'PASSED':
					yield Command('notice')({
						title: `${tag} passed.`,
						file: buildFile,
					})(line);
					break;
				case 'FAILED':
					yield Command('error')({
						title: `${tag} failed.`,
						file: buildFile,
					})(line);
					break;
				case 'NO': // (NO STATUS)
					yield Command('warning')({
						title: `${tag} failed to build.`,
						file: buildFile,
					})(line);
					break;
				default:
					throw new Error(
						`Unknown build status: "${status}" in line: ${line}`
					);
			}
		}
	}
}

export function AnnotateBazelLines(lines: AsyncGenerator<string>) {
	return AnnotateTestFailures(
		AnnotateBuildCompletion(AnnotateDebugStatements(lines))
	);
}

async function* interleave<A, B>(
	a: AsyncIterable<A>,
	b: AsyncIterable<B>
): AsyncGenerator<A | B> {
	const i1 = a[Symbol.asyncIterator]();
	const i2 = b[Symbol.asyncIterator]();

	while (true) {
		const promise1 = i1
			.next()
			.then(res => ({ ...res, iterator: 1 }))
			.catch(
				() => ({ done: true, res: undefined, iterator: 1 }) as const
			);
		const promise2 = i2
			.next()
			.then(res => ({ ...res, iterator: 2 }))
			.catch(
				() => ({ done: true, res: undefined, iterator: 1 }) as const
			);

		const { iterator, ...result } = await Promise.race([
			promise1,
			promise2,
		]);

		if (result?.done && iterator === 1 && (await promise2).done) break;
		if (result?.done && iterator === 2 && (await promise1).done) break;

		if (result && !result.done) yield result.value;
	}
}

export async function Bazel(cwd: string, ...args: string[]) {
	const process = child_process.spawn('bazel', args, { cwd });

	const finish = new Promise<void>(ok => process.on('close', () => ok()));

	for await (const line of interleave(
		AnnotateBazelLines(byLine(process.stdout)),
		AnnotateBazelLines(byLine(process.stderr))
	)) {
		console.log(line);
	}

	if (process.exitCode !== 0)
		throw new Error(`Bazel failed with exit code: ${0}`);

	await finish;
}
