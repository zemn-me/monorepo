/** Launch the Go compatibility gateway and collect its fixture report. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import { runfiles } from '@bazel/runfiles';

import { configuration } from './configuration.js';

export async function compatibilityGateway() {
	const config = configuration();
	const binary = process.env['EMULATOR_GATEWAY'];
	if (!binary) throw new Error('EMULATOR_GATEWAY is required');
	const child = spawn(
		runfiles.resolve(binary),
		[
			'--upstream-port',
			String(config.port),
			'--certificate',
			config.certificate,
		],
		{ stdio: ['pipe', 'pipe', 'inherit'] }
	);
	const calls: string[] = [];
	let forwardedRequests = 0;
	let failure: Error | undefined;
	let reportReady: (() => void) | undefined;
	let reportFailed: ((error: Error) => void) | undefined;
	const lines = createInterface({ input: child.stdout });
	const cleanup = () => {
		child.kill();
	};
	process.once('exit', cleanup);
	const endpoint = await new Promise<string>((resolve, reject) => {
		const fail = (error: Error) => {
			failure = error;
			reportFailed?.(error);
			reject(error);
		};
		child.once('error', fail);
		child.stdin.on('error', fail);
		child.once('exit', (code, signal) => {
			process.removeListener('exit', cleanup);
			fail(new Error(`Emulator gateway exited: ${code ?? signal}`));
		});
		lines.on('line', line => {
			try {
				const event = JSON.parse(line) as {
					endpoint?: string;
					operation?: string;
					forwarded?: boolean;
					report?: boolean;
				};
				if (event.operation) calls.push(event.operation);
				if (event.forwarded) forwardedRequests++;
				if (event.report) reportReady?.();
				if (event.endpoint) resolve(event.endpoint);
			} catch (error) {
				cleanup();
				fail(error instanceof Error ? error : new Error(String(error)));
			}
		});
	});
	return {
		endpoint,
		async report() {
			if (failure) throw failure;
			await new Promise<void>((resolve, reject) => {
				reportReady = resolve;
				reportFailed = reject;
				child.stdin.write('report\n');
			});
			return { calls: [...calls], forwardedRequests };
		},
		close: () => {
			process.removeListener('exit', cleanup);
			cleanup();
			lines.close();
		},
	};
}
