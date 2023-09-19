import child_process from 'node:child_process';

import { Command } from 'ts/github/actions';

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

async function* AnnotateBazelLines(lines: AsyncIterable<string>) {
	for await (const line of lines) {
		const m1 = /\s*FAIL: ([^\s]+) \(see ([^ ]+)\)$/.exec(line);

		if (m1 !== null) {
			yield `${Command('error')({
				title: `${m1[1]} failed`,
			})}`;
			continue;
		}

		yield line;
	}
}

export async function Bazel(cwd: string, ...args: string[]) {
	const process = child_process.spawn('bazel', args, { cwd });

	for await (const line of AnnotateBazelLines(byLine(process.stdout))) {
		console.log(line);
	}

	return process;
}
