import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { resolve } from '#root/ts/future/future.js';

const cacheKey = ['restored-oidc-session'];
jest.unstable_mockModule('#root/project/me/zemn/hook/useGoogleAuth.js', () => ({
	useGoogleAuth: () => [
		resolve('google-token'),
		resolve('google-access'),
		resolve(async () => undefined),
		cacheKey,
		{ logout: () => undefined, switchUser: async () => undefined },
	],
}));
const exchange = jest.fn(async () => {
	throw new Error('Cached credentials must not require a new login');
});
jest.unstable_mockModule('openapi-fetch', () => ({
	default: () => ({ POST: exchange }),
}));
const { useZemnMeAuth } = await import('./useZemnMeAuth.js');
const tokenFor = (jti: string) =>
	`header.${btoa(JSON.stringify({ iss: 'https://api.zemn.me', sub: 'alice', aud: 'zemn.me', iat: 1, exp: 9999999999, jti }))}.signature`;
function Consumer() {
	return useZemnMeAuth()[0](
		token => <output>{token}</output>,
		() => <p>Loading</p>,
		() => <p>Error</p>
	);
}

it('mirrors restored and refreshed Query credentials without blocking auth on a failed cookie write', async () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const authKey = ['zemn-me-oidc-id-token', ...cacheKey];
	const first = tokenFor('first');
	const second = tokenFor('refreshed');
	queryClient.setQueryData(authKey, {
		access_token: first,
		expires_in: 3600,
	});
	const oldFetch = globalThis.fetch;
	const writes: Array<string | undefined> = [];
	globalThis.fetch = jest.fn<typeof fetch>(async (_url, init) => {
		writes.push(
			(init?.headers as Record<string, string> | undefined)?.[
				'Authorization'
			]
		);
		return { ok: false } as Response;
	});
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Consumer />
					<Consumer />
				</QueryClientProvider>
			);
		});
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 10));
		});
		expect(container.querySelector('output')?.textContent).toBe(first);
		expect(writes).toEqual([first]);
		expect(exchange).not.toHaveBeenCalled();
		await act(async () => {
			queryClient.setQueryData(authKey, {
				access_token: second,
				expires_in: 3600,
			});
		});
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 10));
		});
		expect(container.querySelector('output')?.textContent).toBe(second);
		expect(writes).toEqual([first, second]);
	} finally {
		await act(async () => root.unmount());
		queryClient.clear();
		globalThis.fetch = oldFetch;
	}
});
