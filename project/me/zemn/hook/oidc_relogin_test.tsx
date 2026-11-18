import { webcrypto } from 'node:crypto';
import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { resolve } from '#root/ts/future/future.js';

const issuer = 'https://accounts.google.com';
const clientId = 'test-client';
const oldToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'old-subject', exp: 1, nonce: 'old-nonce' })).toString('base64url')}.`;
const freshToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'fresh-subject' })).toString('base64url')}.`;
const switchedToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'switched-subject' })).toString('base64url')}.`;
const popupURLs: URL[] = [];
Object.defineProperty(globalThis, 'crypto', {
	value: webcrypto,
	configurable: true,
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
				id_token: popupURLs.length === 3 ? switchedToken : freshToken,
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
	{
		configuredIssuer: issuer,
		savedToken: oldToken,
		initialLoginHint: 'old-subject',
		google: true,
	},
	{
		configuredIssuer: 'accounts.google.com',
		savedToken: oldToken,
		initialLoginHint: 'old-subject',
		google: true,
	},
	{
		configuredIssuer: issuer,
		savedToken: 'malformed',
		initialLoginHint: null,
		google: true,
	},
	{
		configuredIssuer: issuer,
		savedToken: null,
		initialLoginHint: null,
		google: true,
	},
	{
		configuredIssuer: 'https://other.example',
		savedToken: 'opaque-token',
		initialLoginHint: null,
		google: false,
	},
])(
	'uses saved hints before the first click and preserves logout, reload and switching for %j',
	async ({ configuredIssuer, savedToken, initialLoginHint, google }) => {
		jest.useFakeTimers();
		window.localStorage.clear();
		// Previously derived hints are ignored, including subject-only storage.
		window.localStorage.setItem(
			`zemn-me-oidc-login-hint:${configuredIssuer}:${clientId}`,
			'ignored-legacy-subject'
		);
		if (savedToken !== null) {
			window.localStorage.setItem(
				`zemn-me-oidc-id-token-hint:${configuredIssuer}:${clientId}`,
				savedToken
			);
		}
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
		const settle = async () => {
			await act(async () => {
				await jest.advanceTimersByTimeAsync(1);
			});
		};
		const render = async () => {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Consumer />
					</QueryClientProvider>
				);
			});
			await settle();
		};
		try {
			await render();
			expect(login).toBeDefined();
			await act(async () => {
				const authentication = login?.();
				// Opening the popup must remain synchronous with the login click.
				expect(popupURLs).toHaveLength(1);
				await authentication;
			});
			await settle();
			expect(popupURLs[0]?.searchParams.get('login_hint')).toBe(
				initialLoginHint
			);
			expect(popupURLs[0]?.searchParams.get('id_token_hint')).toBe(
				google ? null : savedToken
			);
			expect(container.textContent).toBe('Logged in');
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
				google ? 'fresh-subject' : null
			);
			expect(popupURLs[1]?.searchParams.get('id_token_hint')).toBe(
				google ? null : freshToken
			);
			await act(async () => {
				const authentication = controls?.switchUser();
				expect(popupURLs).toHaveLength(3);
				await authentication;
			});
			await settle();
			expect(popupURLs[2]?.searchParams.get('prompt')).toBe(
				'select_account'
			);
			expect(popupURLs[2]?.searchParams.has('login_hint')).toBe(false);
			expect(popupURLs[2]?.searchParams.has('id_token_hint')).toBe(false);
			expect(
				window.localStorage.getItem(
					`zemn-me-oidc-id-token-hint:${configuredIssuer}:${clientId}`
				)
			).toBeNull();
			await act(async () => {
				controls?.logout();
			});
			await settle();
			await act(async () => {
				await login?.();
			});
			await settle();
			expect(popupURLs[3]?.searchParams.get('login_hint')).toBe(
				google ? 'switched-subject' : null
			);
			expect(popupURLs[3]?.searchParams.get('id_token_hint')).toBe(
				google ? null : switchedToken
			);
		} finally {
			await act(async () => root.unmount());
			client.clear();
			window.localStorage.clear();
			jest.useRealTimers();
		}
	}
);
