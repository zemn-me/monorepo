import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { get } from 'node:https';

import { runfiles } from '@bazel/runfiles';

import { configuration } from './configuration.js';

const config = configuration();
if (process.argv.includes('--health')) {
	try {
		const ca = await readFile(config.certificate);
		get(`${config.endpoint}/__admin/health`, { ca }, response => {
			response.resume();
			process.exitCode = response.statusCode === 200 ? 0 : 1;
		}).on('error', () => {
			process.exitCode = 1;
		});
	} catch {
		// The service manager retries until the emulator writes its certificate.
		process.exitCode = 1;
	}
} else {
	const location = process.env['EMULATOR_BINARY'];
	if (!location) throw new Error('EMULATOR_BINARY is required');
	await mkdir(config.home, { recursive: true });
	const child = spawn(
		runfiles.resolve(location),
		[
			'--port',
			String(config.port),
			'--telemetry',
			'off',
			'--idle-timeout',
			'900',
		],
		{
			env: { ...process.env, HOME: config.home },
			stdio: 'inherit',
		}
	);
	for (const signal of ['SIGINT', 'SIGTERM'] as const) {
		process.on(signal, () => child.kill(signal));
	}
	child.on('error', error => {
		throw error;
	});
	child.on('exit', code => {
		process.exitCode = code ?? 1;
	});
}
