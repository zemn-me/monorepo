import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useLocalStorageController } from '#root/project/zemn.me/hook/useLocalStorage.js';
import {
	InvalidCallbackMessageError,
	useWindowCallback,
} from '#root/project/zemn.me/hook/useWindowCallback.js';
import { clientSecret } from '#root/project/zemn.me/localStorage/localStorage.js';
import {
	Issuer,
	OAuthClientByIssuer,
} from '#root/project/zemn.me/OAuth/clients.js';
import {
	ID_Token,
	oidcAuthorizeUri,
	watchOutParseIdToken,
} from '#root/ts/oidc/oidc.js';
import { stateStringForRequest } from '#root/ts/oidc/state.js';
import { unwrap_or as option_unwrap_or } from '#root/ts/option/types.js';
import { unwrap_or_else as result_unwrap_or_else } from '#root/ts/result/result.js';

declare global {
	interface Window {}
}

function isUnexpiredIDToken(token: ID_Token): token is ID_Token {
	return token.exp > Math.floor(Date.now() / 1000);
}

export function useOIDC(
	issuer: Issuer
): [string | null, string, () => Promise<void>, boolean] {
	const controller = useLocalStorageController();
	const queryClient = useQueryClient();
	const [requestURL, setRequestURL] = useState('');
	const [effectiveIssuer, setEffectiveIssuer] = useState<string>(issuer);
	const testIssuer =
		process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER ??
		'http://localhost:43111';
	const openWindowCallback = useWindowCallback();
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [pendingState, setPendingState] = useState<string | null>(null);
	const [localToken, setLocalToken] = useState<string | null>(null);
	const tokenQueryKey = useMemo(
		() => ['oidc-id-token', effectiveIssuer] as const,
		[effectiveIssuer]
	);
	const { data: cachedToken } = useQuery<string | null>({
		queryKey: tokenQueryKey,
		queryFn: async () => null,
		initialData: () =>
			queryClient.getQueryData<string | null>(tokenQueryKey) ?? null,
		staleTime: 1000 * 60 * 55,
		gcTime: 1000 * 60 * 60,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		enabled: false,
	});

	useEffect(() => {
		setLocalToken(null);
	}, [effectiveIssuer]);

	const storeToken = useCallback(
		(token: string) => {
			queryClient.setQueryData(tokenQueryKey, token);
			setLocalToken(token);
		},
		[queryClient, tokenQueryKey]
	);

	const beginLogin = useCallback(async () => {
		if (!requestURL) {
			return;
		}

		setIsAuthenticating(true);

		try {
			const target = new URL(requestURL);
			const href = await openWindowCallback(target);
			const callbackUrl = new URL(href, window.location.origin);

			if (callbackUrl.origin !== window.location.origin) {
				throw new InvalidCallbackMessageError(
					'unexpected callback origin'
				);
			}

			const fragment = callbackUrl.hash.startsWith('#')
				? callbackUrl.hash.slice(1)
				: callbackUrl.hash;
			const params = new URLSearchParams(fragment);
			const idToken = params.get('id_token');
			if (!idToken) {
				throw new InvalidCallbackMessageError(
					'callback missing id_token'
				);
			}

			const returnedState = params.get('state');
			if (
				pendingState &&
				returnedState &&
				pendingState !== returnedState
			) {
				console.warn('OIDC state mismatch', {
					expected: pendingState,
					returned: returnedState,
				});
			}

			storeToken(idToken);
			setPendingState(null);
		} catch (error) {
			console.error('OIDC login failed', error);
		} finally {
			setIsAuthenticating(false);
		}
	}, [openWindowCallback, pendingState, requestURL, storeToken]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const host = window.location.hostname;
		if (host === 'localhost' || host === '127.0.0.1') {
			setEffectiveIssuer(testIssuer);
		} else {
			setEffectiveIssuer(issuer);
		}
	}, [issuer, testIssuer]);

	const useTestIssuer = effectiveIssuer !== issuer;
	const client = OAuthClientByIssuer(effectiveIssuer);

	useEffect(() => {
		let cancelled = false;

		async function computeRequestURL() {
			if (typeof window === 'undefined') {
				return;
			}

			const callback = new URL(window.location.origin);
			callback.pathname = '/callback';
			callback.search = '';
			callback.hash = '';

			try {
				if (useTestIssuer) {
					let nonce: string;
					if (typeof window.crypto?.getRandomValues === 'function') {
						const random = new Uint8Array(16);
						window.crypto.getRandomValues(random);
						nonce = Array.from(random, b =>
							b.toString(16).padStart(2, '0')
						).join('');
					} else {
						nonce = Math.random().toString(36).slice(2);
					}
					const authUrl = new URL('/authorize', effectiveIssuer);
					authUrl.search = new URLSearchParams({
						response_type: 'id_token',
						client_id: client.clientId,
						redirect_uri: callback.toString(),
						scope: 'openid',
						nonce,
						state: nonce,
					}).toString();
					setPendingState(nonce);
					setRequestURL(authUrl.toString());
					return;
				}

				const ctrl = option_unwrap_or(controller, null);
				if (ctrl === null) {
					setRequestURL('');
					setPendingState(null);
					return;
				}

				const masterKey = await clientSecret(ctrl);
				const state = await stateStringForRequest(await masterKey, {
					issuer: effectiveIssuer,
					clientId: client.clientId,
					redirectUri: callback.toString(),
				});

				setPendingState(state);

				const authUrlResult = await oidcAuthorizeUri(
					state,
					state,
					callback,
					client.clientId,
					new URL(effectiveIssuer)
				);

				const authUrl = result_unwrap_or_else(authUrlResult, err => {
					console.error(
						'Failed to build OIDC authorization URL',
						err
					);
					return callback;
				});

				if (!cancelled) {
					setRequestURL(authUrl.toString());
				}
			} catch (err) {
				console.error('Failed to prepare OIDC request', err);
				if (!cancelled) {
					setRequestURL('');
					setPendingState(null);
				}
			}
		}

		void computeRequestURL();

		return () => {
			cancelled = true;
		};
	}, [controller, effectiveIssuer, useTestIssuer, client.clientId, issuer]);

	useEffect(() => {
		if (!cachedToken) {
			return;
		}
		const parsed = watchOutParseIdToken.safeParse(cachedToken);
		if (
			!parsed.success ||
			parsed.data.iss !== effectiveIssuer ||
			!isUnexpiredIDToken(parsed.data)
		) {
			queryClient.setQueryData(tokenQueryKey, null);
		}
	}, [cachedToken, effectiveIssuer, queryClient, tokenQueryKey]);

	const token = useMemo(() => {
		const candidates = [localToken, cachedToken];
		for (const candidate of candidates) {
			if (!candidate) {
				continue;
			}
			const parsed = watchOutParseIdToken.safeParse(candidate);
			if (!parsed.success) {
				continue;
			}
			const claims = parsed.data;
			if (claims.iss !== effectiveIssuer) {
				continue;
			}
			if (!isUnexpiredIDToken(claims)) {
				continue;
			}
			return candidate;
		}
		return null;
	}, [cachedToken, effectiveIssuer, localToken]);

	return [token, requestURL, beginLogin, isAuthenticating];
}
