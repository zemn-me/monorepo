import { afterEach, expect, it, jest } from '@jest/globals';
import { updateSessionCookie } from './session_cookie.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

it('logout waits for an in-flight cookie write, and cancelled login writes cannot restore it', async () => {
	let finishLogin: (() => void) | undefined;
	const calls: string[] = [];
	globalThis.fetch = jest.fn<typeof fetch>(async (_url, init) => {
		calls.push(init?.method ?? 'GET');
		if (init?.method === 'POST')
			await new Promise<void>(resolve => {
				finishLogin = resolve;
			});
		return { ok: true } as Response;
	});
	const controller = new AbortController();
	const login = updateSessionCookie('token', controller.signal);
	await Promise.resolve();
	await Promise.resolve();
	expect(calls).toEqual(['POST']);
	const queued = updateSessionCookie('old-token', controller.signal).catch(
		error => error
	);
	controller.abort();
	const logout = updateSessionCookie(null);
	await Promise.resolve();
	expect(calls).toEqual(['POST']);
	finishLogin?.();
	await login;
	expect(await queued).toBeInstanceOf(DOMException);
	await logout;
	expect(calls).toEqual(['POST', 'DELETE']);
});

it('a failed write does not block a later logout and failures are reported', async () => {
	let attempt = 0;
	globalThis.fetch = jest.fn<typeof fetch>(
		async () => ({ ok: ++attempt > 1 }) as Response
	);
	await expect(updateSessionCookie(null)).rejects.toThrow(
		'Could not update your login'
	);
	await expect(updateSessionCookie(null)).resolves.toBe(true);
});
