import { PartitionIndex } from '@pulumi/aws/glue';
import { skipToken, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ZodSafeParseResult } from 'zod';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { FOREIGN_ID_TOKEN_ISSUER } from '#root/project/zemn.me/constants/constants.js';
import {
	useWindowCallback,
} from '#root/project/zemn.me/hook/useWindowCallback.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import {
	OAuthClientByIssuer,
} from '#root/project/zemn.me/OAuth/clients.js';
import { OIDCAuthenticationRequest } from '#root/ts/oidc/authentication_request.js';
import { OIDCAuthenticationResponse } from '#root/ts/oidc/authentication_response.js';
import { openidConfiguration } from '#root/ts/oidc/configuration.js';
import {
	oidcConfigURLForIssuer,
} from '#root/ts/oidc/oidc.js';
import { validateAuthenticationRequest } from '#root/ts/oidc/validate_authentication_request.js';
import { Option } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';
import { queryResult } from '#root/ts/result/react-query/queryResult.js';
import * as result from '#root/ts/result/result.js';



export type useOIDCReturnType = [
	id_token: Option<string>,
	promptForLogin: Option<() => Promise<void>>,
];

async function fetchEntropy(): Promise<string> {
  const bytes = new Uint8Array(128); // 1024 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function _useOIDCConfig<E>(issuer: result.Result<string, E>) {
	return useQuery({
		queryFn:
			result.unwrap_or(
				result.and_then(
					issuer,
					issuer => () => fetch(oidcConfigURLForIssuer(issuer))
					.then(config => config.json())
				),
				skipToken
			),
		queryKey: ["oidc-config", result.unwrap_or(
			issuer,
			"none",
		)],
	})
}

function simplifyFuture<T, E, S>(future: Option<result.Result<T, E>>, v: S) {
	return result.flatten(option.unwrap_or(
		option.and_then(
			future,
			v => result.Ok(v)
		),
		result.Err(v)
	))
}

function r<T, E>(q: UseQueryResult<T, E>) {
	const a = queryResult(q);
	const b = option.and_then(
		a,
		v => result.Ok(v)
	)

	const c = simplifyFuture(b, "loading!" as const)

	return result.flatten(
		c
	)
}

export type SafeParseResult<T, E> = SafeParseSuccess<T> | SafeParseError<E>;
export type SafeParseSuccess<T> = {
    success: true;
    data: T;
    error?: never;
};
export type SafeParseError<E> = {
    success: false;
    error: E
};


function rr<T, E>(v: SafeParseResult<T, E>):
	result.Result<T, E>
{
	return v.success?
		result.Ok(v.data) : result.Err(v.error)
}
export function useOIDCConfig<E>(issuer: result.Result<string, E>) {
	return result.flatten(result.and_then(
		r(_useOIDCConfig(issuer)),
		v => {
			const vv = openidConfiguration.safeParse(v);
			// dont ask me
			type P =
				typeof vv extends SafeParseResult<
					infer M, infer MM>
				? SafeParseResult<Exclude<M, undefined>, MM>
				: never
			;
			return rr(vv as P)
		}
	))
}

export function useEntropy<E>(partitionKey: result.Result<string, E>) {
	return r(useQuery({
		queryKey: ['useoidc entropy', result.unwrap_or(
			partitionKey,
			"none",
		)],
		queryFn: result.unwrap_or(result.and_then(
			partitionKey,
			() => fetchEntropy
		), skipToken),
		staleTime: Infinity
	}))
}

interface UseOIDCParams {
	issuer: string
	params: Omit<OIDCAuthenticationRequest, 'nonce' | 'state' | 'callback'>
}

export function useOIDC<E>(params: result.Result<UseOIDCParams, E>): useOIDCReturnType {
	const apiFetchClient = useFetchClient();
	const issuer = result.and_then_field(params, "issuer");
	const oidc_config = useOIDCConfig(issuer);

	const authorizationEndpoint = result.and_then_field(
		oidc_config,
		"authorization_endpoint"
	)

	const entropyQuery = useEntropy(issuer);
	const rqParams = result.and_then_field(params, "params");

	const unvalidatedAuthRq = result.zipped(
		rqParams,
		entropyQuery,
		(params, e): OIDCAuthenticationRequest => ({
			...params,
			state: e,
			redirect_uri: `${window.location.origin}/callback`,
			nonce: e
		})
	);

	const authRq = result.flatten(result.zipped(
		unvalidatedAuthRq,
		oidc_config,
		(rq, config) => validateAuthenticationRequest(rq, config)
	));

	const targetURL = result.zipped(
		authorizationEndpoint,
		authRq,
		(endpoint, params) => {
			const u = new URL(endpoint);
			u.search = (new URLSearchParams(params)).toString();
			return u;
		}
	)

	const [ callback, requestCallback ] = useWindowCallback();

	const callbackV = simplifyFuture(callback, "waiting for user..." as const);

	const requestConsent = result.and_then(
		targetURL, u => () => requestCallback(u)
	);

	const nonValidatedAuthResponse = result.and_then(
		callbackV,
		v => {
			const href = new URL(v);


			const r = OIDCAuthenticationResponse.parse(
				Object.fromEntries([
					...href.searchParams,
					...new URLSearchParams(
						href.hash.slice(1)
					)
				])
			);

			return r;
		}
	);

	const authResponse = result.flatten(result.zipped(
		nonValidatedAuthResponse,
		entropyQuery,
		(r, e) => {
			// this should be a fixed-time string comparison
			// but all the fixed-time string comparisons are
			// promises in webcrypto and if I have to do that
			// rn I may kms
			if (r.state != e) return result.Err(
				new Error(["invalid state:", r.state, "!=", e].join(" "))
			)

			return result.Ok(r)
		}
	));

	const authSuccessResponse = result.and_then_flatten(
		authResponse,
		v => 'error' in v
			? result.Err(new Error(v.error))
			: result.Ok(v)
	)

	const id_token = result.and_then_flatten(
		authSuccessResponse,
		v => v.id_token !== undefined
			? result.Ok(v.id_token)
			: result.Err(new Error('missing id_token'))
	);

	const request_body = result.and_then(
		id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	)

	const exchangeQueryFn = result.and_then(
		request_body,
		body => () => apiFetchClient
			.POST('/oauth2/token', {
				body,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			})
			.then(response => {
				if (response.error !== undefined) {
					throw new Error(response.error.error);
				}
				const token = response.data.access_token;
				if (!token) {
					throw new Error('missing access_token');
				}
				return token;
			})
	);

	const exchangedTokenRsp = useQuery({
		queryKey: ['oidc-id-token', result.unwrap_or(issuer, "none")],
		queryFn: result.unwrap_or(exchangeQueryFn, skipToken),
		staleTime: 100 * 60 * 55 // idk
	});
	const exchangedToken =
		exchangedTokenRsp.status === 'success'
			? option.Some(exchangedTokenRsp.data)
			: option.None

	return [exchangedToken, requestConsent];
}
