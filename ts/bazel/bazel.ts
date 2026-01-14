import childProcess from 'node:child_process';
import readline from 'node:readline';

export type BuildEvent = {
	id?: Record<string, unknown>;
	payload?: Record<string, unknown>;
	[key: string]: unknown;
};

export type BazelOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	bazelBinary?: string;
	forwardOutput?: boolean;
	buildEventJsonFile?: string;
};

export type BazelRun = {
	process: childProcess.ChildProcess;
	events: AsyncGenerator<BuildEvent>;
	exit: Promise<number | null>;
};

const buildEventJsonFlag = '--build_event_json_file';

export function withBuildEventJsonFile(
	args: readonly string[],
	buildEventJsonFile = 'PIPE'
): string[] {
	const next: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i]!;
		if (arg === buildEventJsonFlag) {
			i += 1;
			continue;
		}
		if (arg.startsWith(`${buildEventJsonFlag}=`)) continue;
		next.push(arg);
	}
	return [...next, `${buildEventJsonFlag}=${buildEventJsonFile}`];
}

export async function* parseBuildEventJsonLines(
	stream: NodeJS.ReadableStream
): AsyncGenerator<BuildEvent> {
	const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
	for await (const line of rl) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		yield JSON.parse(trimmed) as BuildEvent;
	}
}

function bepStream(process: childProcess.ChildProcess): NodeJS.ReadableStream {
	const stream = process.stdio[3];
	if (stream && typeof stream !== 'number') {
		return stream as NodeJS.ReadableStream;
	}
	if (process.stdout) return process.stdout;
	throw new Error(
		'BEP stream is unavailable; ensure stdio includes a pipe for fd 3.'
	);
}

export function spawnBazelWithBep(
	args: readonly string[],
	{
		cwd,
		env,
		bazelBinary = 'bazel',
		forwardOutput = true,
		buildEventJsonFile = 'PIPE',
	}: BazelOptions = {}
): BazelRun {
	const spawnArgs = withBuildEventJsonFile(args, buildEventJsonFile);
	const process = childProcess.spawn(bazelBinary, spawnArgs, {
		cwd,
		env,
		stdio: ['inherit', 'pipe', 'pipe', 'pipe'],
	});

	if (forwardOutput) {
		process.stdout?.pipe(globalThis.process.stdout);
		process.stderr?.pipe(globalThis.process.stderr);
	}

	const events = parseBuildEventJsonLines(bepStream(process));
	const exit = new Promise<number | null>(resolve =>
		process.on('close', resolve)
	);

	return { process, events, exit };
}
