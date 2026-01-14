import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
	Command,
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

function buildTagToBuildFile(buildTag: string): string | undefined {
	const m = /^\/\/([^:]+):(.*)/.exec(buildTag);

	if (m === null) return undefined;

	const [, packagePath] = m;

	return path.join(packagePath, 'BUILD.bazel');
}

type BuildEvent = {
	id?: Record<string, unknown>;
	payload?: Record<string, unknown>;
};

type BuildAnnotations = {
	annotations: string[];
	failures: string[];
	errorObserved: boolean;
};

function getIdLabel(id: BuildEvent['id']): string | undefined {
	if (!id) return undefined;
	const keys = Object.keys(id);
	if (keys.length !== 1) return undefined;
	const key = keys[0];
	const value = id[key] as Record<string, unknown> | undefined;
	if (value && typeof value === 'object' && 'label' in value) {
		const label = value.label;
		return typeof label === 'string' ? label : undefined;
	}
	return undefined;
}

function annotationForStatus(
	label: string,
	status: string,
	title: string,
	level: 'error' | 'warning'
): string {
	const buildFile = buildTagToBuildFile(label);
	return Command(level)({
		title,
		file: buildFile,
	})(`${label} ${status}`);
}

export function annotationsFromBuildEvents(events: BuildEvent[]): BuildAnnotations {
	const annotations: string[] = [];
	const failures = new Set<string>();
	let errorObserved = false;

	for (const event of events) {
		const payload = event.payload ?? {};
		if ('aborted' in payload) {
			const aborted = payload.aborted as Record<string, unknown>;
			const description =
				typeof aborted.description === 'string'
					? aborted.description
					: 'Build aborted';
			const reason =
				typeof aborted.reason === 'string' ? aborted.reason : 'UNKNOWN';
			const line = Command('error')({
				title: `Build aborted (${reason})`,
			})(description);
			annotations.push(line);
			errorObserved = true;
			continue;
		}

		if ('testSummary' in payload) {
			const summary = payload.testSummary as Record<string, unknown>;
			const overallStatus =
				typeof summary.overallStatus === 'string'
					? summary.overallStatus
					: 'UNKNOWN';
			if (overallStatus !== 'PASSED') {
				const label = getIdLabel(event.id) ?? '//:unknown';
				const level =
					overallStatus === 'FLAKY' || overallStatus === 'NO_STATUS'
						? 'warning'
						: 'error';
				const line = annotationForStatus(
					label,
					overallStatus,
					`${label} ${overallStatus.toLowerCase()}`,
					level
				);
				annotations.push(line);
				if (level === 'error') {
					failures.add(label);
					errorObserved = true;
				}
			}
			continue;
		}

		if ('targetSummary' in payload) {
			const summary = payload.targetSummary as Record<string, unknown>;
			const overallBuildSuccess = summary.overallBuildSuccess;
			if (overallBuildSuccess === false) {
				const label = getIdLabel(event.id) ?? '//:unknown';
				const line = annotationForStatus(
					label,
					'FAILED',
					`${label} failed`,
					'error'
				);
				annotations.push(line);
				failures.add(label);
				errorObserved = true;
			}
			continue;
		}

		if ('completed' in payload) {
			const completed = payload.completed as Record<string, unknown>;
			if (completed.success === false) {
				const label = getIdLabel(event.id) ?? '//:unknown';
				const line = annotationForStatus(
					label,
					'FAILED',
					`${label} failed`,
					'error'
				);
				annotations.push(line);
				failures.add(label);
				errorObserved = true;
			}
		}
	}

	return {
		annotations,
		failures: Array.from(failures),
		errorObserved,
	};
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
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bazel-bep-'));
	const bepPath = path.join(tempDir, 'bep.jsonl');
	const hasBepFlag = args.some(arg =>
		arg.startsWith('--build_event_json_file')
	);
	let bepPathToRead = bepPath;
	if (!hasBepFlag) {
		args = [...args, `--build_event_json_file=${bepPath}`];
	} else {
		const flag = args.find(arg =>
			arg.startsWith('--build_event_json_file')
		);
		if (flag) {
			const parts = flag.split('=');
			if (parts.length === 2 && parts[1]) {
				bepPathToRead = parts[1]!;
			}
		}
	}

	const process = child_process.spawn('bazelisk', args, { cwd });

	const exitCode = new Promise<number | null>(ok =>
		process.on('close', e => ok(e))
	);
	const errors: Error[] = [];
	process.addListener('error', e => errors.push(e));
	/**
	 * If a github actions error is observed in any line.
	 */
	let errorObserved = false;

	for await (const line of interleave(
		byLine(process.stdout),
		byLine(process.stderr)
	)) {
		// eslint-disable-next-line no-console
		console.log(line);
	}

	try {
		const bepText = await fs.readFile(bepPathToRead, 'utf8');
		const events = bepText
			.split(/\r?\n/g)
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.map(line => JSON.parse(line) as BuildEvent);

		const summary = annotationsFromBuildEvents(events);
		for (const line of summary.annotations) {
			if (!errorObserved && /^::error/.test(line)) errorObserved = true;
			// eslint-disable-next-line no-console
			console.log(line);
		}
		if (summary.failures.length > 0) {
			await Summarize(`# Build failure.
The failing tags can be retried on a local machine manually via:
\`\`\`bash
bazel test ${summary.failures.join(' ')}
\`\`\`
`);
		}
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(
			`Failed to read build event json file at ${bepPathToRead}: ${error}`
		);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
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

	if (errorObserved) {
		throw new Error(
			`Bazel exited successfully, but at least one error was observed.`
		);
	}
}
