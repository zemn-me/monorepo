import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import Path from 'node:path';

import { Command, FilePositionParams } from 'ts/github/actions';

/**
 * Drink bytes from the Readable, returning each line.
 */
async function* byLine(r: NodeJS.ReadableStream) {
	let chunks: (string | Buffer)[] = [];
	for await (const chunk of r) {
		// attempt to split the chunk on a new line
		const split = chunk.toString().split(/\r?\n/g);
		if (split.length == 1) {
			chunks.push(chunk);
			continue;
		}

		yield [...chunks, split[0]].join('');
		chunks = [split[1]];
	}
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
		})(await fs.readFile(logFilePath).toString());
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

export async function Bazel(cwd: string, ...args: string[]) {
	const process = child_process.spawn('bazel', args, { cwd });

	for await (const line of AnnotateBazelLines(byLine(process.stdout))) {
		console.log(line);
	}

	return process;
}
