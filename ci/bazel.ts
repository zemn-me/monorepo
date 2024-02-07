import child_process from 'node:child_process';
import fs from 'node:fs/promises';

import {
	Command,
	FilePositionParams,
	Summarize,
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

async function* AnnotateBuildCompletion(lines: AsyncGenerator<string>) {
	const failures: string[] = [];

	const it = lines[Symbol.asyncIterator]();
	let done: boolean | undefined = false;

	const take = async (): Promise<string | undefined> => {
		const resp = await it.next();

		done = resp.done;

		if (done) return undefined;

		return resp.value;
	};

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	while (!done) {
		const line = await take();
		if (line === undefined) continue;
		// parse block of success / failure notices
		const match =
			/^\s*(\/\/([^:]*):[^ ]+)\s+(?:\(cached\))? (PASSED|FAILED|NO STATUS) in ([\d.]+s?)/.exec(
				line
			);

		if (match === null) {
			yield line;
			continue;
		}

		const [, tag, packageName, status, time] = match;

		const buildFile = packageName + '/BUILD.bazel';

		switch (status) {
			case 'PASSED':
				yield line;
				/*
				yield Command('notice')({
					title: `${tag} passed in ${time}`,
					file: buildFile,
				})(line);
				*/
				break;
			case 'FAILED': {
				failures.push(tag!);
				const nextLine = (await take())?.trim();
				yield Command('error')({
					title: `${tag} failed in ${time}`,
					file: buildFile,
				})(
					line +
						(nextLine !== undefined && nextLine
							? `\n${await fs.readFile(nextLine)}`
							: '')
				);
				break;
			}
			case 'NO STATUS':
				yield Command('warning')({
					title: `${tag} failed to build in ${time}`,
					file: buildFile,
				})(line);
				break;
			default:
				yield line;
				yield Command('error')({})(
					`unknown build status: "${status}" in ${line}`
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
	return AnnotateBuildCompletion(
		AnnotateBazelFailures(AnnotateDebugStatements(lines))
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
	args.push('--noshow_progress');
	const process = child_process.spawn('bazelisk', args, { cwd });

	const exitCode = new Promise<number | null>(ok =>
		process.on('close', e => ok(e))
	);
	const errors: Error[] = [];
	process.addListener('error', e => errors.push(e));

	for await (const line of interleave(
		AnnotateBazelLines(byLine(process.stdout)),
		AnnotateBazelLines(byLine(process.stderr))
	)) {
		// eslint-disable-next-line no-console
		console.log(line);
	}

	if ((await exitCode) !== 0)
		throw new Error(`Bazel failed with exit code: ${process.exitCode}`);

	if (errors.length > 0) {
		// eslint-disable-next-line no-console
		console.info('Failure.');
		throw errors[0];
	}

	if (process.exitCode !== 0) {
		throw new Error(`Bazel failed with exit code: ${process.exitCode}`);
	}
}
