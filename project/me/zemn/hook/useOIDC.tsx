import {
	QueryKey,
	SkipToken,
	skipToken,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';

import {
	oidcSessionQueryKey,
	readOIDCIdTokenHint,
	readOIDCSession,
	resetAuthenticationSession,
} from '#root/project/me/zemn/hook/authentication_session.js';
import { useOIDCConfig } from '#root/project/me/zemn/hook/useOIDCConfig.js';
import { useWindowCallback } from '#root/project/me/zemn/promise/window_callback.js';
import { fixedTimeStringEquals } from '#root/ts/crypto/fixed_time_string_comparison.js';
import {
	coincide_then,
	error,
	Future,
	future_and_then,
	future_flatten_then,
	resolve,
} from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { OIDCAuthenticationRequest } from '#root/ts/oidc/authentication_request.js';
import { OIDCAuthenticationResponse } from '#root/ts/oidc/authentication_response.js';
import { validateAuthenticationRequest } from '#root/ts/oidc/validate_authentication_request.js';
import * as option from '#root/ts/option/types.js';
import { Err, Ok } from '#root/ts/result/result.js';
import { Second } from '#root/ts/time/duration.js';

export type OIDCImplicitRequest = Omit<
	OIDCAuthenticationRequest,
	| 'response_type'
	| 'redirect_uri'
	| 'state'
	| 'nonce'
	| 'display'
	| 'id_token_hint'
	| 'registration'
	| 'request'
	| 'request_uri'
>;

export interface OIDCSessionControls {
	readonly logout: () => void;
	readonly switchUser: () => Promise<void>;
}

async function fetchEntropy(): Promise<string> {
	const bytes = new Uint8Array(128);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function authenticationStaleTime(response: unknown) {
	const parsed = OIDCAuthenticationResponse.safeParse(response);
	return parsed.success &&
		'expires_in' in parsed.data &&
		parsed.data.expires_in !== undefined
		? parseInt(parsed.data.expires_in, 10) * Second
		: 0;
}

export function useOIDC(
	issuer: string,
	params: OIDCImplicitRequest
): [
	id_token: Future<string, void, Error>,
	access_token: Future<string, void, Error>,
	promptForLogin: Future<() => Promise<void>, void, Error>,
	/** can use to cache bust dependent queries */
	cacheKey: QueryKey,
	sessionControls: OIDCSessionControls,
] {
	const queryClient = useQueryClient();
	const oidc_config = useOIDCConfig(issuer);
	const sessionQueryKey = oidcSessionQueryKey(issuer, params.client_id);
	const { data: session } = useQuery({
		queryKey: sessionQueryKey,
		queryFn: () => 0,
		initialData: () =>
			typeof window === 'undefined'
				? 0
				: readOIDCSession(
						window.localStorage,
						issuer,
						params.client_id
					),
		// A stale persisted cache must not replace the dedicated logout clock.
		initialDataUpdatedAt: () =>
			typeof window === 'undefined' ? 0 : Date.now(),
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const entropy = useQueryFuture(
		useQuery({
			queryKey: ['useoidc entropy', issuer],
			queryFn: fetchEntropy,
			staleTime: Infinity,
		})
	);

	const authRq = future_and_then(
		entropy,
		(e: string): OIDCAuthenticationRequest => {
			const idTokenHint = readOIDCIdTokenHint(
				window.localStorage,
				issuer,
				params.client_id
			);
			return {
				response_type: 'id_token token',
				...params,
				redirect_uri: `${window.location.origin}/callback`,
				state: e,
				nonce: e,
				scope: Array.from(
					new Set(['openid', ...params.scope.split(' ')])
				).join(' '),
				...(idTokenHint === null ? {} : { id_token_hint: idTokenHint }),
			};
		}
	);

	const validated_authrq = future_flatten_then(
		coincide_then(oidc_config, authRq, (config, rq) =>
			validateAuthenticationRequest(rq, config)(
				() => resolve(rq),
				err => error(err)
			)
		)
	);

	const targetURL = coincide_then(
		oidc_config,
		validated_authrq,
		(config, requestParams) => {
			const url = new URL(config.authorization_endpoint);
			url.search = new URLSearchParams(requestParams).toString();
			return url;
		}
	);
	const cacheKeyArgs: QueryKey = [issuer, params, session];

	const authenticate = (url: URL) => async () => {
		// Run this before the first await so the popup remains tied to the click.
		const callbackHref = useWindowCallback(url);
		const href = new URL(await callbackHref);
		const responseParams = OIDCAuthenticationResponse.parse(
			Object.fromEntries([
				...href.searchParams,
				...new URLSearchParams(href.hash.slice(1)),
			])
		);

		(
			await option.option_from_maybe_undefined(responseParams.state)(
				() =>
					Err(new Error('missing state in authentication response')),
				state =>
					entropy(
						async e =>
							(await fixedTimeStringEquals(e, state))
								? Ok(undefined)
								: Err(
										new Error(
											[
												'invalid state:',
												state,
												'!=',
												e,
											].join(' ')
										)
									),
						() => Err(new Error('this should never happen')),
						() => Err(new Error('this should never happen'))
					)
			)
		)(
			e => {
				throw e;
			},
			() => {
				/* intentionally empty */
			}
		);

		return responseParams;
	};

	const callbackQuery = useQuery({
		queryKey: ['use-oidc', ...cacheKeyArgs],
		gcTime: Infinity,
		queryFn: targetURL(
			url => authenticate(url),
			(() => skipToken) as () => SkipToken,
			(() => skipToken) as () => SkipToken
		),
		staleTime: query => authenticationStaleTime(query.state.data),
		enabled: false,
	});

	const callbackQueryResult = useQueryFuture(callbackQuery);
	const requestConsent = future_and_then(targetURL, () => async () => {
		const response = await callbackQuery.refetch();
		if (response.error) throw response.error;
	});

	const successfulResponse = future_flatten_then(
		future_and_then(callbackQueryResult, response =>
			'error' in response
				? error(new Error(response.error))
				: resolve(response)
		)
	);
	const id_token = future_flatten_then(
		future_and_then(successfulResponse, response =>
			response.id_token !== undefined
				? resolve(response.id_token)
				: error(new Error('missing id_token'))
		)
	);
	const access_token = future_flatten_then(
		future_and_then(successfulResponse, response =>
			response.access_token !== undefined
				? resolve(response.access_token)
				: error(new Error('missing access_token'))
		)
	);

	const latestIdToken =
		callbackQuery.data !== undefined &&
		'id_token' in callbackQuery.data &&
		callbackQuery.data.id_token !== undefined
			? callbackQuery.data.id_token
			: null;
	const endSession = (idTokenHint: string | null) => {
		const nextSession = session + 1;
		resetAuthenticationSession({
			clientId: params.client_id,
			idTokenHint,
			issuer,
			nextSession,
			queryClient,
			storage: window.localStorage,
		});
		return nextSession;
	};

	const sessionControls: OIDCSessionControls = {
		logout: () => endSession(latestIdToken),
		switchUser: () =>
			targetURL(
				url => {
					const switchUserURL = new URL(url);
					switchUserURL.searchParams.delete('id_token_hint');
					switchUserURL.searchParams.set('prompt', 'select_account');
					const authentication = authenticate(switchUserURL)();
					const nextSession = endSession(null);
					return queryClient
						.fetchQuery({
							queryKey: ['use-oidc', issuer, params, nextSession],
							queryFn: () => authentication,
							gcTime: Infinity,
							staleTime: query =>
								authenticationStaleTime(query.state.data),
						})
						.then(() => undefined);
				},
				() => Promise.reject(new Error('OIDC login is not ready')),
				err => Promise.reject(err)
			),
	};

	return [
		id_token,
		access_token,
		requestConsent,
		cacheKeyArgs,
		sessionControls,
	] as const;
}
