import { useQuery } from '@tanstack/react-query';

import { useOIDCConfig } from '#root/project/zemn.me/hook/useOIDCConfig.js';
import {
	useWindowCallback,
} from '#root/project/zemn.me/promise/window_callback.js';
import { OIDCAuthenticationRequest } from '#root/ts/oidc/authentication_request.js';
import { OIDCAuthenticationResponse } from '#root/ts/oidc/authentication_response.js';
import { validateAuthenticationRequest } from '#root/ts/oidc/validate_authentication_request.js';
import { Option } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';
import * as result from '#root/ts/result/result.js';


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

export type useOIDCReturnType = [
	id_token: Option<string>,
	access_token: Option<string>,
	promptForLogin: Option<() => Promise<void>>,
];

async function fetchEntropy(): Promise<string> {
	const bytes = new Uint8Array(128); // 1024 bits
	crypto.getRandomValues(bytes);
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function useOIDC(issuer: string, params: OIDCImplicitRequest): useOIDCReturnType {
	const oidc_config = useOIDCConfig(issuer);

	const entropy = useQuery({
		queryKey: ['useoidc entropy', issuer],
		queryFn: fetchEntropy,
		staleTime: Infinity,
	});

	const authorizationEndpoint =
		oidc_config.status === 'success'
			? option.Some(oidc_config.data.authorization_endpoint)
			: option.None;

	if (oidc_config.status == 'error') throw new Error(oidc_config.error.message);

	const authRq: Option<OIDCAuthenticationRequest> =
		entropy.status === 'success'
			? option.Some<OIDCAuthenticationRequest>({
				response_type: 'id_token token',
				...params,
				redirect_uri: `${window.location.origin}/callback`,
				state: entropy.data,
				nonce: entropy.data,
				scope: Array.from(new Set(['openid', ...params.scope.split(' ')])).join(' '),
			})
			: option.None;

	const validation =
		option.flatten(oidc_config.status === 'success'
			? option.and_then(authRq, authRq => validateAuthenticationRequest(authRq, oidc_config.data))
			: option.None);

	if (option.is_some(validation))
		throw option.unwrap_unchecked(validation);

	const targetURL =
		option.and_then(
			option.zip(authorizationEndpoint, authRq),
			([endpoint, params]) => {
				const u = new URL(endpoint);
				u.search = (new URLSearchParams(params)).toString();
				return u;
			}
		);

	const cacheKeyArgs = [issuer, params];
	const callbackQuery = useQuery({
		queryKey: ['use-oidc', ...cacheKeyArgs],
		queryFn: () => {
			if (option.is_none(targetURL)) {
				throw new Error('missing authorization endpoint');
			}
			return useWindowCallback(option.unwrap_unchecked(targetURL));
		},
		enabled: false,
	});

	const requestConsent = option.and_then(
		targetURL, () => async () => {
			const response = await callbackQuery.refetch();
			if (response.error) {
				throw response.error;
			}
		}
	);

	const callbackV =
		callbackQuery.status === 'success'
			? option.Some(callbackQuery.data)
			: option.None;

	const authResponse = option.and_then(
		callbackV,
		v => {
			const href = new URL(v);

			const r = OIDCAuthenticationResponse.parse(
				Object.fromEntries([
					...href.searchParams,
					...new URLSearchParams(
						href.hash.slice(1)
					),
				])
			);

			return r;
		}
	);

	if (entropy.status === 'success')
		option.and_then(
			authResponse,
			r => {
				// this should be a fixed-time string comparison
				// but all the fixed-time string comparisons are
				// promises in webcrypto and if I have to do that
				// rn I may kms
				if (r.state != entropy.data)
					throw new Error(["invalid state:", r.state, "!=", entropy.data].join(" "));
			}
		);

	const authSuccessResponse =
		option.and_then(
			authResponse,
			v =>
				result.unwrap('error' in v ? result.Err(new Error(v.error)) : result.Ok(v))
		);

	const id_token = option.and_then(
		authSuccessResponse,
		v =>
			result.unwrap(
				v.id_token !== undefined
					? result.Ok(v.id_token)
					: result.Err(new Error('missing id_token'))
			)
	);

	const access_token = option.and_then(
		authSuccessResponse,
		v =>
			result.unwrap(
				v.access_token !== undefined
					? result.Ok(v.access_token)
					: result.Err(new Error('missing access_token'))
			)
	);

	return [id_token, access_token, requestConsent];
}
