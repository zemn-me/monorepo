import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen';
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
import { ZEMN_ME_API_BASE } from '#root/project/zemn.me/constants/constants.js';
import {
	ID_Token,
	oidcAuthorizeUri,
	watchOutParseIdToken,
} from '#root/ts/oidc/oidc.js';
import { stateStringForRequest } from '#root/ts/oidc/state.js';
import { unwrap_or as option_unwrap_or } from '#root/ts/option/types.js';
import { unwrap_or_else as result_unwrap_or_else } from '#root/ts/result/result.js';

function isUnexpiredIDToken(token: ID_Token): token is ID_Token {
	return token.exp > Math.floor(Date.now() / 1000);
}

type TokenResponse = components['schemas']['TokenResponse'];

async function exchangeIdToken(subjectToken: string): Promise<string> {
	const body = new URLSearchParams({
		grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
		subject_token: subjectToken,
		subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
		requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
	});

	const response = await fetch(`${ZEMN_ME_API_BASE}/oauth2/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(
			`token exchange failed (${response.status}): ${details || 'no body'}`
		);
	}

	const payload = (await response.json()) as TokenResponse;
	if (!payload.access_token) {
		throw new Error('token exchange response missing access_token');
	}

	return payload.access_token;
}

export function useOIDC(
	issuer: Issuer
): [string | null, string, () => Promise<void>, boolean, string | null] {
	const controller = useLocalStorageController();
	const queryClient = useQueryClient();
	const [requestURL, setRequestURL] = useState('');
	const [effectiveIssuer, setEffectiveIssuer] = useState<string>(issuer);
	const [forceProductionIssuer, setForceProductionIssuer] = useState(false);
	const testIssuer =
		process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER ??
		'http://localhost:43111';
	const openWindowCallback = useWindowCallback();
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [pendingState, setPendingState] = useState<string | null>(null);
	const tokenQueryKey = useMemo(
		() => ['oidc-id-token', effectiveIssuer] as const,
		[effectiveIssuer]
	);
	const existingToken =
		queryClient.getQueryData<string | null>(tokenQueryKey) ?? null;
	let staleTime = 1000 * 60 * 55;
	let gcTime = 1000 * 60 * 60;
	if (existingToken) {
		const parsed = watchOutParseIdToken.safeParse(existingToken);
		if (parsed.success) {
			const remainingMs = parsed.data.exp * 1000 - Date.now();
			if (remainingMs > 0) {
				staleTime = remainingMs;
				gcTime = Math.max(remainingMs, 5 * 60 * 1000);
			} else {
				staleTime = 0;
				gcTime = 5 * 60 * 1000;
			}
		}
	}
	const { data: cachedToken } = useQuery<string | null>({
		queryKey: tokenQueryKey,
		queryFn: async () => null,
		initialData: () => existingToken,
		staleTime,
		gcTime,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		enabled: false,
	});
	const [authError, setAuthError] = useState<string | null>(null);

	const beginLogin = useCallback(async () => {
		if (!requestURL) {
			return;
		}

		setIsAuthenticating(true);
		setAuthError(null);

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
			throw new InvalidCallbackMessageError(
				`state mismatch: expected ${pendingState}, got ${returnedState}`
			);
		}

			const exchangedToken = await exchangeIdToken(idToken);
			queryClient.setQueryData(tokenQueryKey, exchangedToken);
			setPendingState(null);
			setAuthError(null);
		} catch (error) {
			console.error('OIDC login failed', error);
			setAuthError(error instanceof Error ? error.message : String(error));
			queryClient.setQueryData(tokenQueryKey, null);
		} finally {
			setIsAuthenticating(false);
		}
	}, [openWindowCallback, pendingState, queryClient, requestURL, tokenQueryKey]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const updateForce = () => {
			const hash = window.location.hash ?? '';
			setForceProductionIssuer(hash.includes('useGoogleSSO'));
		};
		updateForce();
		window.addEventListener('hashchange', updateForce);
		return () => {
			window.removeEventListener('hashchange', updateForce);
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const host = window.location.hostname;
		if (!forceProductionIssuer && (host === 'localhost' || host === '127.0.0.1')) {
			setEffectiveIssuer(testIssuer);
		} else {
			setEffectiveIssuer(issuer);
		}
	}, [forceProductionIssuer, issuer, testIssuer]);

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

			const makeRandomState = () => {
				if (typeof window.crypto?.getRandomValues === 'function') {
					const random = new Uint8Array(16);
					window.crypto.getRandomValues(random);
					return Array.from(random, b => b.toString(16).padStart(2, '0')).join('');
				}
				return Math.random().toString(36).slice(2);
			};

			try {
				if (useTestIssuer) {
					const nonce = makeRandomState();
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
					const fallbackState = makeRandomState();
					const authUrlResult = await oidcAuthorizeUri(
						fallbackState,
						fallbackState,
						callback,
						client.clientId,
						new URL(effectiveIssuer)
					);
					const authUrl = result_unwrap_or_else(authUrlResult, err => {
						console.error('Failed to build OIDC authorization URL', err);
						return callback;
					});
					if (!cancelled) {
						setPendingState(fallbackState);
						setRequestURL(authUrl.toString());
					}
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
		if (!parsed.success || !isUnexpiredIDToken(parsed.data)) {
			queryClient.setQueryData(tokenQueryKey, null);
		}
	}, [cachedToken, queryClient, tokenQueryKey]);

	const token = useMemo(() => {
		if (!cachedToken) {
			return null;
		}
		const parsedToken = watchOutParseIdToken.safeParse(cachedToken);
		if (!parsedToken.success) {
			return null;
		}
		if (!isUnexpiredIDToken(parsedToken.data)) {
			return null;
		}
		return cachedToken;
	}, [cachedToken]);

	return [token, requestURL, beginLogin, isAuthenticating, authError];
}
