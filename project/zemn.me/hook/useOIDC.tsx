import { useQuery } from '@tanstack/react-query';

import { useOIDCConfig } from '#root/project/zemn.me/hook/useOIDCConfig.js';
import {
	useWindowCallback,
} from '#root/project/zemn.me/promise/window_callback.js';
import { fixedTimeStringEquals } from '#root/ts/crypto/fixed_time_string_comparison.js';
import { coincide_then, error, Future, future_and_then, future_flatten_then, loading, resolve } from '#root/ts/future/future.js';
import { useQueryFuture, useQueryFuture_flatten } from '#root/ts/future/react-query/useQuery.js';
import { OIDCAuthenticationRequest } from '#root/ts/oidc/authentication_request.js';
import { OIDCAuthenticationResponse } from '#root/ts/oidc/authentication_response.js';
import { validateAuthenticationRequest } from '#root/ts/oidc/validate_authentication_request.js';
import * as option from '#root/ts/option/types.js';
import { Err, Ok } from '#root/ts/result/result.js';
import { Second } from '#root/ts/time/duration.js';


export type OIDCImplicitRequest = Omit<
	OIDCAuthenticationRequest,
	'response_type'
	| 'redirect_uri'
	| 'state'
	| 'nonce'
	| 'display'
	| 'id_token_hint'
	| 'registration'
	| 'request'
	| 'request_uri'
>;

async function fetchEntropy(): Promise<string> {
	const bytes = new Uint8Array(128); // 1024 bits
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function useOIDC(issuer: string, params: OIDCImplicitRequest): [
	id_token: Future<string, void, Error>,
	access_token: Future<string, void, Error>,
	promptForLogin: Future<() => Promise<void>, void, Error>,
] {
	const oidc_config = useOIDCConfig(issuer);

	const entropy = useQueryFuture(useQuery({
		queryKey: ['useoidc entropy', issuer],
		queryFn: fetchEntropy,
		staleTime: Infinity,
	}));

	const authRq = future_and_then(
		entropy,
		(e: string): OIDCAuthenticationRequest => ({
			response_type: 'id_token token',
			...params,
			redirect_uri: `${window.location.origin}/callback`,
			state: e,
			nonce: e,
			scope: Array.from(new Set(['openid', ...params.scope.split(' ')])).join(' '),
		})
	)

	const validated_authrq = future_flatten_then(coincide_then(
		oidc_config, authRq,
		(config, rq) =>
			validateAuthenticationRequest(
				rq, config
			)(
				() => resolve(rq),
				err => error(err),
			)
	));

	const targetURL = coincide_then(
		oidc_config, validated_authrq,
		(config, params) => {
			const u = new URL(config.authorization_endpoint);
			u.search = (new URLSearchParams(params)).toString();
			return u;
		}
	)
	const cacheKeyArgs = [issuer, params];

	const callbackQuery = useQuery({
		queryKey: ['use-oidc', ...cacheKeyArgs],
		queryFn: async () => targetURL(
			async u => {
				// sadly must immediately parse to allow staleTime
				// to be set correctly.
				const href = new URL(await useWindowCallback(u));

				const params = OIDCAuthenticationResponse.parse(
					Object.fromEntries([
						...href.searchParams,
						...new URLSearchParams(
							href.hash.slice(1)
						),
					])
				);


				// perform state validation
				(await option.option_from_maybe_undefined(params.state)(
					() => Err(new Error('missing state in authentication response')),
					state => entropy(
						async e => await fixedTimeStringEquals(e, state)
							? Ok(undefined)
							: Err(new Error(["invalid state:", state, "!=", e].join(" "))),
						() => Err(new Error('this should never happen')),
						() => Err(new Error('this should never happen')),
					)
				))(
					e => { throw e },
					() => { }
				)

				return resolve(params);
			},
			async ld => loading(ld),
			async err => error(err),

		),
		staleTime: r =>
			option.option_from_maybe_undefined(r.state.data)(
				(/*None*/) => 0,
				fut => fut(
					v => 'expires_in' in v && v.expires_in !== undefined
						? parseInt(v.expires_in, 10) * Second
						: 0,
					() => 0, // loading
					() => 0, // error
				)
			),
		enabled: false
	});

	const callbackQueryResult = useQueryFuture_flatten(callbackQuery);

	const requestConsent = future_and_then(
		targetURL, () => async () => {
			const response = await callbackQuery.refetch();
			if (response.error) {
				throw response.error;
			}
		}
	);

	const callbackQueryResultWithHandledErrorCallback = future_flatten_then(future_and_then(
		callbackQueryResult,
		resp => 'error' in resp
			? error(new Error(resp.error))
			: resolve(resp)
	));


	const id_token = future_flatten_then(future_and_then(
		callbackQueryResultWithHandledErrorCallback,
		resp => resp.id_token !== undefined
			? resolve(resp.id_token)
			: error(new Error('missing id_token'))
	));

	const access_token = future_flatten_then(future_and_then(
		callbackQueryResultWithHandledErrorCallback,
		resp => resp.access_token !== undefined
			? resolve(resp.access_token)
			: error(new Error('missing access_token'))
	));


	return [id_token, access_token, requestConsent] as const;
}
