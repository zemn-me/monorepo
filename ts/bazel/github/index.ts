import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
	spawnBazelWithBep,
	type BazelOptions,
	type BuildEvent,
} from '#root/ts/bazel/bazel.js';
import { Command, Summarize } from '#root/ts/github/actions/index.js';

type BuildAnnotations = {
	annotations: string[];
	failures: string[];
	failedTests: string[];
	errorObserved: boolean;
};

type BuildEventJson = BuildEvent & {
	payload?: Record<string, unknown>;
	id?: Record<string, unknown>;
};

const getEventPayload = (event: BuildEvent): Record<string, unknown> => {
	const jsonEvent = event as BuildEventJson;
	const payload = jsonEvent.payload ?? jsonEvent;
	return payload as Record<string, unknown>;
};

function buildTagToBuildFile(buildTag: string): string | undefined {
	const match = /^\/\/([^:]+):(.*)/.exec(buildTag);
	if (match === null) return undefined;
	const packagePath = match[1]!;
	return path.join(packagePath, 'BUILD.bazel');
}

function getIdLabel(id: unknown): string | undefined {
	if (!id || typeof id !== 'object') return undefined;
	const keys = Object.keys(id as Record<string, unknown>);
	if (keys.length !== 1) return undefined;
	const key = keys[0];
	if (!key) return undefined;
	const value = (id as Record<string, unknown>)[key];
	if (value && typeof value === 'object' && 'label' in value) {
		const label = (value as { label?: unknown }).label;
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

function levelForStatus(status: string): 'error' | 'warning' {
	return status === 'FLAKY' || status === 'NO_STATUS' ? 'warning' : 'error';
}

export function annotationsFromBuildEvents(
	events: BuildEvent[]
): BuildAnnotations {
	const annotations: string[] = [];
	const failures = new Set<string>();
	const failedTests = new Set<string>();
	const abortedSeen = new Set<string>();
	let errorObserved = false;

	for (const event of events) {
		const payload = getEventPayload(event);

		if ('aborted' in payload) {
			const aborted = payload.aborted as Record<string, unknown> | undefined;
			const description =
				aborted && typeof aborted.description === 'string'
					? aborted.description
					: 'Build aborted';
			const reason =
				aborted && typeof aborted.reason === 'string'
					? aborted.reason
					: 'UNKNOWN';
			const line = Command('error')({
				title: `Build aborted (${reason})`,
			})(description);
			if (!abortedSeen.has(line)) {
				annotations.push(line);
				abortedSeen.add(line);
			}
			errorObserved = true;
			continue;
		}

		if ('testSummary' in payload) {
			const summary = payload.testSummary as Record<string, unknown> | undefined;
			const overallStatus =
				summary && typeof summary.overallStatus === 'string'
					? summary.overallStatus
					: 'UNKNOWN';
			if (overallStatus !== 'PASSED') {
				const label = getIdLabel((event as BuildEventJson).id) ?? '//:unknown';
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
				if (overallStatus !== 'FLAKY' && overallStatus !== 'NO_STATUS') {
					failedTests.add(label);
				}
				if (level === 'error') {
					failures.add(label);
					errorObserved = true;
				}
			}
			continue;
		}

		if ('targetSummary' in payload) {
			const summary = payload.targetSummary as Record<string, unknown> | undefined;
			const overallBuildSuccess = summary?.overallBuildSuccess;
			if (overallBuildSuccess === false) {
				const label = getIdLabel((event as BuildEventJson).id) ?? '//:unknown';
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
			const completed = payload.completed as Record<string, unknown> | undefined;
			if (completed?.success === false) {
				const label = getIdLabel((event as BuildEventJson).id) ?? '//:unknown';
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

		if ('finished' in payload) {
			const finished = payload.finished as Record<string, unknown> | undefined;
			const exitCode = finished?.exitCode as Record<string, unknown> | undefined;
			const code = exitCode?.code;
			const name =
				exitCode && typeof exitCode.name === 'string'
					? exitCode.name
					: 'UNKNOWN';
			if (code !== 0) {
				const line = Command('error')({
					title: `Build finished (${name})`,
				})(`Exit code ${code ?? 'unknown'}`);
				annotations.push(line);
				errorObserved = true;
			}
		}
	}

	return {
		annotations,
		failures: Array.from(failures),
		failedTests: Array.from(failedTests),
		errorObserved,
	};
}

export type GithubBazelOptions = BazelOptions & {
	summarizeFailures?: boolean;
	printBepEvents?: boolean;
	fallbackToFile?: boolean;
	bepMode?: 'pipe' | 'file';
	printBazelOutput?: boolean;
};

type ActionLog = {
	label: string;
	mnemonic?: string;
	stdout?: Record<string, unknown>;
	stderr?: Record<string, unknown>;
};

type TestLog = {
	label: string;
	status: string;
	failed: Record<string, unknown>[];
};

function parseBuildEventJsonLines(text: string): BuildEvent[] {
	return text
		.split(/\r?\n/g)
	.map(line => line.trim())
	.filter(line => line.length > 0)
		.map(line => JSON.parse(line) as BuildEvent);
}

/**
 * Drink bytes from the Readable, returning each line.
 */
async function* byLine(r: NodeJS.ReadableStream) {
	const chunks: (string | Buffer)[] = [];
	for await (const chunk of r) {
		const lines = chunk.toString().split(/\r?\n/g);

		if (lines.length < 2) {
			chunks.push(...lines.filter(v => v.length > 0));
			continue;
		}

		const last = lines.pop();
		yield* [chunks.join(''), ...lines];

		if (last) chunks.push(last);
	}

	const text = chunks.join('');
	if (text.length !== 0) yield text;
}

/**
 * Interleave the results of two AsyncIterables. Whichever gets there fastest, gets there first.
 */
async function* interleave<A, B>(
	a: AsyncIterable<A>,
	b: AsyncIterable<B>
): AsyncGenerator<A | B> {
	const its = [a, b].map(v => v[Symbol.asyncIterator]());
	const nexts = its.map((it, i) => it.next().then(res => ({ ...res, i })));

	const dones: (boolean | undefined)[] = its.map(() => false);

	while (!dones.every(v => v)) {
		const res = await Promise.race(nexts.filter((_, i) => !dones[i]));

		nexts[res.i] = its[res.i]!.next().then(v => ({ ...v, i: res.i }));

		dones[res.i] = res.done;
		if (!res.done) yield res.value;
	}
}

async function runWithPipeBep(
	args: string[],
	options: BazelOptions,
	printBepEvents: boolean,
	printBazelOutput: boolean
): Promise<{ events: BuildEvent[]; exitCode: number | null }> {
	const { events, exit, process: bazelProcess } = spawnBazelWithBep(args, {
		...options,
		forwardOutput: false,
	});
	if (printBazelOutput) {
		const groupStart = Command('group')({});
		const groupEnd = Command('endgroup')({});
		// eslint-disable-next-line no-console
		console.log(groupStart('Bazel output'));
		if (bazelProcess.stdout && bazelProcess.stderr) {
			for await (const line of interleave(
				byLine(bazelProcess.stdout),
				byLine(bazelProcess.stderr)
			)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		} else if (bazelProcess.stdout) {
			for await (const line of byLine(bazelProcess.stdout)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		} else if (bazelProcess.stderr) {
			for await (const line of byLine(bazelProcess.stderr)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		}
		// eslint-disable-next-line no-console
		console.log(groupEnd());
	}
	const collected: BuildEvent[] = [];
	for await (const event of events) {
		collected.push(event);
		if (printBepEvents) {
			// eslint-disable-next-line no-console
			console.log(JSON.stringify(event));
		}
	}
	const exitCode = await exit;
	return { events: collected, exitCode };
}

async function runWithFileBep(
	args: string[],
	options: BazelOptions,
	printBepEvents: boolean,
	printBazelOutput: boolean
): Promise<{ events: BuildEvent[]; exitCode: number | null }> {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bazel-bep-'));
	const bepPath = path.join(tempDir, 'bep.jsonl');
	const { exit, process: bazelProcess } = spawnBazelWithBep(args, {
		...options,
		forwardOutput: false,
		buildEventJsonFile: bepPath,
	});
	if (printBazelOutput) {
		const groupStart = Command('group')({});
		const groupEnd = Command('endgroup')({});
		// eslint-disable-next-line no-console
		console.log(groupStart('Bazel output'));
		if (bazelProcess.stdout && bazelProcess.stderr) {
			for await (const line of interleave(
				byLine(bazelProcess.stdout),
				byLine(bazelProcess.stderr)
			)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		} else if (bazelProcess.stdout) {
			for await (const line of byLine(bazelProcess.stdout)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		} else if (bazelProcess.stderr) {
			for await (const line of byLine(bazelProcess.stderr)) {
				// eslint-disable-next-line no-console
				console.log(line);
			}
		}
		// eslint-disable-next-line no-console
		console.log(groupEnd());
	}
	const exitCode = await exit;

	let events: BuildEvent[] = [];
	try {
		const bepText = await fs.readFile(bepPath, 'utf8');
		events = parseBuildEventJsonLines(bepText);
		if (printBepEvents) {
			for (const event of events) {
				// eslint-disable-next-line no-console
				console.log(JSON.stringify(event));
			}
		}
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(`Failed to read build event json file at ${bepPath}: ${error}`);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}

	return { events, exitCode };
}

function readFileContents(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
	if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
		return Buffer.from(value as number[]).toString('utf8');
	}
	return undefined;
}

function resolveFilePath(
	file: Record<string, unknown>,
	cwd: string
): string | undefined {
	const uri = file.uri;
	if (typeof uri === 'string') {
		if (uri.startsWith('file://')) {
			return decodeURIComponent(uri.replace('file://', ''));
		}
		if (uri.startsWith('/')) return uri;
		if (!uri.includes('://')) return path.join(cwd, uri);
	}
	const pathPrefix = file.pathPrefix;
	const name = file.name;
	if (Array.isArray(pathPrefix) && typeof name === 'string') {
		const prefix = pathPrefix.filter(v => typeof v === 'string') as string[];
		if (prefix.length > 0) {
			return path.join(cwd, ...prefix, name);
		}
	}
	return undefined;
}

async function readActionOutput(
	file: Record<string, unknown>,
	cwd: string
): Promise<string | undefined> {
	const direct = readFileContents(file.contents);
	if (direct) return direct;
	const filePath = resolveFilePath(file, cwd);
	if (!filePath) return undefined;
	try {
		return await fs.readFile(filePath, 'utf8');
	} catch {
		return undefined;
	}
}

function truncateOutput(text: string, maxChars = 4000): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n…(truncated)…`;
}

export async function bazelWithGithubAnnotations(
	args: string[],
	{
		summarizeFailures = true,
		printBepEvents = false,
		fallbackToFile = true,
		bepMode = 'file',
		printBazelOutput = false,
		...options
	}: GithubBazelOptions = {}
): Promise<void> {
	const cwd =
		options.cwd ??
		process.env.BUILD_WORKSPACE_DIRECTORY ??
		process.cwd();
	const baseOptions: BazelOptions = { ...options, cwd };
	const groupStart = Command('group')({});
	const groupEnd = Command('endgroup')({});
	if (printBepEvents) {
		// eslint-disable-next-line no-console
		console.log(groupStart('BEP events'));
	}

	let collected: BuildEvent[] = [];
	let exitCode: number | null = null;
	if (bepMode === 'pipe') {
		({ events: collected, exitCode } = await runWithPipeBep(
			args,
			baseOptions,
			printBepEvents,
			printBazelOutput
		));
		if (collected.length === 0 && fallbackToFile) {
			// eslint-disable-next-line no-console
			console.log('No BEP events received from PIPE; retrying with file output.');
			({ events: collected, exitCode } = await runWithFileBep(
				args,
				baseOptions,
				printBepEvents,
				printBazelOutput
			));
		}
	} else {
		({ events: collected, exitCode } = await runWithFileBep(
			args,
			baseOptions,
			printBepEvents,
			printBazelOutput
		));
	}

	if (collected.length === 0) {
		// eslint-disable-next-line no-console
		console.log('No BEP events received.');
	}
	if (printBepEvents) {
		// eslint-disable-next-line no-console
		console.log(groupEnd());
	}

	const summary = annotationsFromBuildEvents(collected);
	const failedActions: ActionLog[] = [];
	const failedTestLogs: TestLog[] = [];
	for (const event of collected) {
		const payload = getEventPayload(event);
		if ('action' in payload) {
			const action = payload.action as Record<string, unknown> | undefined;
			if (action?.success === false) {
				const label =
					getIdLabel((event as BuildEventJson).id) ??
					(typeof action.label === 'string' ? action.label : '//:unknown');
				failedActions.push({
					label,
					mnemonic: typeof action.type === 'string' ? action.type : undefined,
					stdout:
						typeof action.stdout === 'object' && action.stdout
							? (action.stdout as Record<string, unknown>)
							: undefined,
					stderr:
						typeof action.stderr === 'object' && action.stderr
							? (action.stderr as Record<string, unknown>)
							: undefined,
				});
			}
		}
		if ('testSummary' in payload) {
			const summaryPayload = payload.testSummary as Record<string, unknown> | undefined;
			const overallStatus =
				summaryPayload && typeof summaryPayload.overallStatus === 'string'
					? summaryPayload.overallStatus
					: 'UNKNOWN';
			if (overallStatus !== 'PASSED') {
				const label =
					getIdLabel((event as BuildEventJson).id) ?? '//:unknown';
				const failed = Array.isArray(summaryPayload?.failed)
					? (summaryPayload?.failed as Record<string, unknown>[])
					: [];
				failedTestLogs.push({
					label,
					status: overallStatus,
					failed,
				});
			}
		}
	}

	const testAnnotationLines = new Set(
		failedTestLogs.map(test => test.label)
	);
	const nonTestAnnotations = summary.annotations.filter(line => {
		for (const label of testAnnotationLines) {
			if (line.includes(label)) return false;
		}
		return true;
	});
	for (const line of nonTestAnnotations) {
		// eslint-disable-next-line no-console
		console.log(line);
	}

	for (const test of failedTestLogs) {
		const groupStart = Command('group')({});
		const groupEnd = Command('endgroup')({});
		// eslint-disable-next-line no-console
		console.log(groupStart(`Test failed: ${test.label} (${test.status})`));
		let firstSnippet: string | undefined;
		if (test.failed.length === 0) {
			// eslint-disable-next-line no-console
			console.log('No failed test logs available in BEP.');
		}
		for (const file of test.failed.slice(0, 5)) {
			const content = await readActionOutput(file, cwd);
			if (content) {
				if (!firstSnippet) {
					firstSnippet = truncateOutput(content, 800);
				}
				// eslint-disable-next-line no-console
				console.log(truncateOutput(content));
			}
		}
		const annotationMessage = firstSnippet
			? `${test.label} ${test.status}\n${firstSnippet}`
			: `${test.label} ${test.status}`;
		// eslint-disable-next-line no-console
		console.log(
			Command(levelForStatus(test.status))({
				title: `${test.label} ${test.status.toLowerCase()}`,
				file: buildTagToBuildFile(test.label),
			})(annotationMessage)
		);
		// eslint-disable-next-line no-console
		console.log(groupEnd());
	}

	for (const action of failedActions) {
		const title = action.mnemonic
			? `${action.label} (${action.mnemonic})`
			: action.label;
		const groupStart = Command('group')({});
		const groupEnd = Command('endgroup')({});
		// eslint-disable-next-line no-console
		console.log(groupStart(`Action failed: ${title}`));

		let outputPrinted = false;
		if (action.stdout) {
			const content = await readActionOutput(action.stdout, cwd);
			if (content) {
				// eslint-disable-next-line no-console
				console.log(`STDOUT:\n${truncateOutput(content)}`);
				outputPrinted = true;
			}
		}
		if (action.stderr) {
			const content = await readActionOutput(action.stderr, cwd);
			if (content) {
				// eslint-disable-next-line no-console
				console.log(`STDERR:\n${truncateOutput(content)}`);
				outputPrinted = true;
			}
		}
		if (!outputPrinted) {
			// eslint-disable-next-line no-console
			console.log('No action stdout/stderr available in BEP.');
		}

		// eslint-disable-next-line no-console
		console.log(groupEnd());
	}

	const failedTests =
		summary.failedTests.length > 0
			? summary.failedTests
			: summary.failures;
	if (summarizeFailures && failedTests.length > 0) {
		await Summarize(`# Build failure.
The failing tags can be retried on a local machine manually via:
\`\`\`bash
bazel test ${failedTests.join(' ')}
\`\`\`
`);
	}

	if (exitCode !== 0) {
		throw new Error(`Bazel failed with exit code: ${exitCode}`);
	}

	if (summary.errorObserved) {
		throw new Error(
			'Bazel exited successfully, but at least one error was observed.'
		);
	}
}
