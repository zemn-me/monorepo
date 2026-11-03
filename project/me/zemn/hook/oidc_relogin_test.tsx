import { webcrypto } from 'node:crypto';
import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { resolve } from '#root/ts/future/future.js';
import { hasOIDCLoginHintStrategy } from '#root/ts/oidc/login_hint.js';

const issuer = 'https://accounts.google.com';
const clientId = 'test-client';
const popupURLs: URL[] = [];
const resolveHint = jest.fn<
	(
		issuer: string,
		clientId: string,
		token: string,
		nonce: string
	) => Promise<string | undefined>
>(async () => 'verified-subject');
Object.defineProperty(globalThis, 'crypto', {
	value: webcrypto,
	configurable: true,
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
jest.unstable_mockModule('#root/ts/oidc/login_hint.js', () => ({
	hasOIDCLoginHintStrategy,
	resolveOIDCLoginHint: resolveHint,
}));
jest.unstable_mockModule('#root/project/me/zemn/hook/useOIDCConfig.js', () => ({
	useOIDCConfig: () =>
		resolve({
			authorization_endpoint: 'https://accounts.google.com/auth',
			scopes_supported: ['openid'],
			response_types_supported: ['id_token token'],
		}),
}));
jest.unstable_mockModule(
	'#root/project/me/zemn/promise/window_callback.js',
	() => ({
		useWindowCallback: async (url: URL) => {
			popupURLs.push(new URL(url));
			const callback = new URL('http://localhost/callback');
			callback.hash = new URLSearchParams({
				id_token: 'synthetic-token',
				access_token: 'synthetic-access',
				state: url.searchParams.get('state') ?? '',
				expires_in: '3600',
			}).toString();
			return callback.toString();
		},
	})
);
const { useOIDC } = await import('./useOIDC.js');

it.each([
	{ configuredIssuer: issuer, hint: 'verified-subject' },
	{ configuredIssuer: issuer, hint: undefined },
	{ configuredIssuer: 'https://other.example', hint: undefined },
])(
	'logs out, reloads, re-logs in, and switches accounts for %j',
	async ({ configuredIssuer, hint }) => {
		resolveHint.mockResolvedValue(hint);
		window.localStorage.clear();
		popupURLs.length = 0;
		let login: (() => Promise<void>) | undefined;
		let controls: ReturnType<typeof useOIDC>[4] | undefined;
		function Consumer() {
			const result = useOIDC(configuredIssuer, {
				client_id: clientId,
				scope: 'openid',
			});
			login = result[2](
				value => value,
				() => undefined,
				() => undefined
			);
			controls = result[4];
			return (
				<output>
					{result[0](
						() => 'Logged in',
						() => 'Logged out',
						() => 'Error'
					)}
				</output>
			);
		}
		let client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const container = document.createElement('div');
		let root = createRoot(container);
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Consumer />
					</QueryClientProvider>
				);
			});
			await act(async () => {
				await new Promise(resolve => setTimeout(resolve, 20));
			});
		};
		const settle = async () => {
			await act(async () => {
				await new Promise(resolve => setTimeout(resolve, 20));
			});
		};
		try {
			await render();
			expect(login).toBeDefined();
			await act(async () => {
				await login?.();
			});
			await settle();
			expect(container.textContent).toBe('Logged in');
			expect(resolveHint).toHaveBeenCalledWith(
				configuredIssuer,
				clientId,
				'synthetic-token',
				popupURLs[0]?.searchParams.get('nonce') ?? ''
			);
			await act(async () => {
				controls?.logout();
			});
			await settle();
			expect(container.textContent).toBe('Logged out');
			await act(async () => root.unmount());
			client.clear();
			client = new QueryClient({
				defaultOptions: { queries: { retry: false } },
			});
			root = createRoot(container);
			await render();
			await act(async () => {
				await login?.();
			});
			await settle();
			expect(popupURLs[1]?.searchParams.get('login_hint')).toBe(
				hint ?? null
			);
			expect(popupURLs[1]?.searchParams.get('id_token_hint')).toBe(
				hint ? null : 'synthetic-token'
			);
			await act(async () => {
				await controls?.switchUser();
			});
			await settle();
			expect(popupURLs[2]?.searchParams.get('prompt')).toBe(
				'select_account'
			);
			expect(popupURLs[2]?.searchParams.has('login_hint')).toBe(false);
			expect(popupURLs[2]?.searchParams.has('id_token_hint')).toBe(false);
		} finally {
			await act(async () => root.unmount());
			client.clear();
			window.localStorage.clear();
		}
	}
);
