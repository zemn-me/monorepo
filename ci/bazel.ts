import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import Path from 'node:path';

import { Command, FilePositionParams, Summarize } from 'ts/github/actions';

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

	const m2 = /.*bazel\/_bazel_runner\/[^/]+\/(.*)/.exec(filePath);

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

		const failures: string[] = [];

		for await (const line of it) {
			// parse subsequent block of success / failure notices
			const match = /^\s*(\/\/([^:]*):[^ ]+)\s+([^ ]+)/.exec(line);

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
					})(`${tag} passed.\n` + line);
					break;
				case 'FAILED':
					failures.push(tag);
					yield Command('error')({
						title: `${tag} failed.`,
						file: buildFile,
					})(`${tag} failed.\n` + line);
					break;
				case 'NO': // (NO STATUS)
					yield Command('warning')({
						title: `${tag} failed to build.`,
						file: buildFile,
					})(`${tag} failed to build\n` + line);
					break;
				default:
					throw new Error(
						`Unknown build status: "${status}" in line: ${line}`
					);
			}
		}

		if (failures.length > 0)
			await Summarize(`# Build failure.
The failing tags can be retried on a local machine manually via:
\`\`\`bash
bazel test ${failures.join(' ')}
\`\`\`
`);
	}
}

export function AnnotateBazelLines(lines: AsyncGenerator<string>) {
	return AnnotateTestFailures(
		AnnotateBuildCompletion(AnnotateDebugStatements(lines))
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
		nexts[res.i] = its[res.i].next().then(v => ({ ...v, i: res.i }));

		yield res.value;

		dones[res.i] = res.done;
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
