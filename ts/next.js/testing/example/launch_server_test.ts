/* eslint-disable no-console */
import child_process from 'node:child_process';
import http from 'node:http';
import * as readline from 'node:readline/promises';

import { isDefined, isNotNull, must } from '#root/ts/guard.js';

test('next.js dev server launch!', async () => {
	const next_server_binary = 'ts/next.js/testing/example/dev.sh';
	const BAZEL_BINDIR = must(isDefined)(process.env.BAZEL_BINDIR);

	const proc = child_process.execFile(next_server_binary, {
		env: { BAZEL_BINDIR },
	});

	console.info('Waiting for process to go up...');

	await new Promise((ok, err) => {
		proc.once('error', err);
		proc.once('spawn', ok);
	});

	const output: NodeJS.WritableStream = must(isNotNull)(proc.stdin);
	const input: NodeJS.ReadableStream = must(isNotNull)(proc.stdout);

	for await (const line of readline.createInterface({
		input, // not really needed, we're not asking Qs.
		output,
	})) {
		console.info(line);
		const m = /https:\/\/localhost:\d+/g.exec(line);
		if (m?.[0]) {
			// attempt to connect to the port
			const resp: http.IncomingMessage = await new Promise(ok =>
				http.get(m[0], resp => ok(resp))
			);
			expect(resp.statusCode).toBe(200);

			break;
		}
	}
});
