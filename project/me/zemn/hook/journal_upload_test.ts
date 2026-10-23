import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from '@jest/globals';

import { uploadJournalAudio } from './journal_upload.js';

const servers: Server[] = [];
afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(server => {
			server.closeAllConnections();
			return new Promise<void>((resolve, reject) => {
				server.close(error => (error ? reject(error) : resolve()));
			});
		})
	);
});

// Use jsdom’s maintained XMLHttpRequest, including CORS preflight, against
// a real HTTP service instead of stubbing each transport method.
async function uploadDestination(receive: RequestListener) {
	const server = createServer((request, response) => {
		response.setHeader('Access-Control-Allow-Origin', '*');
		if (request.method === 'OPTIONS') {
			response.writeHead(204, {
				'Access-Control-Allow-Methods': 'PUT',
				'Access-Control-Allow-Headers': 'Content-Type',
			});
			response.end();
			return;
		}
		receive(request, response);
	});
	servers.push(server);
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/audio`,
		method: 'PUT' as const,
		headers: { 'Content-Type': 'audio/webm' },
		expiresAt: '2026-09-20T12:00:00Z',
	};
}

it('sends audio and waits for the full server response when byte counts are unavailable', async () => {
	let receive!: (request: {
		method: string | undefined;
		type: string | undefined;
		body: string;
	}) => void;
	const received = new Promise<Parameters<typeof receive>[0]>(resolve => {
		receive = resolve;
	});
	let accept!: () => void;
	const accepted = new Promise<void>(resolve => {
		accept = resolve;
	});
	const destination = await uploadDestination(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(Buffer.from(chunk));
		receive({
			method: request.method,
			type: request.headers['content-type'],
			body: Buffer.concat(chunks).toString(),
		});
		response.writeHead(200, { 'Content-Length': '2' });
		response.flushHeaders();
		await accepted;
		response.end('ok');
	});
	const progress: Array<number | undefined> = [];
	let transferred!: () => void;
	const transferFinished = new Promise<void>(resolve => {
		transferred = resolve;
	});
	let completed = false;
	const result = uploadJournalAudio(
		destination,
		new Blob(['audio']),
		value => {
			progress.push(value);
			if (value === undefined) transferred();
		}
	).then(() => {
		completed = true;
	});

	try {
		expect(await received).toEqual({
			method: 'PUT',
			type: 'audio/webm',
			body: 'audio',
		});
		await transferFinished;
		expect(progress[0]).toBe(0);
		expect(progress).toContain(undefined);
		expect(completed).toBe(false);
	} finally {
		accept();
		await result;
	}
	expect(completed).toBe(true);
});

it('reports a server rejection instead of treating completed transfer as success', async () => {
	const destination = await uploadDestination((_request, response) => {
		response.writeHead(403);
		response.end();
	});

	await expect(
		uploadJournalAudio(destination, new Blob(['audio']))
	).rejects.toThrow('Audio upload failed (403).');
});

it('reports a connection lost before the server responds', async () => {
	const destination = await uploadDestination(request => {
		request.socket.destroy();
	});

	await expect(
		uploadJournalAudio(destination, new Blob(['audio']))
	).rejects.toThrow('Audio upload failed.');
});
