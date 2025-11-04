import { useQuery } from '@tanstack/react-query';

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
import { Option, option_result_and_then, option_result_option_result_flatten, option_result_promise_transpose, option_result_result_flatten, option_result_zipped } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';
import { queryResult } from '#root/ts/result/react-query/queryResult.js';
import { Err, Ok } from '#root/ts/result/result.js';
import * as result from '#root/ts/result/result.js';



export type useOIDCReturnType = [
	id_token: Option<string>,
	promptForLogin: () => Promise<void>,
];

async function fetchEntropy(): Promise<string> {
  const bytes = new Uint8Array(128); // 1024 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}


export function useOIDC() {
	const issuer =
		FOREIGN_ID_TOKEN_ISSUER;

	const oauthClient = OAuthClientByIssuer(issuer);
	const apiFetchClient = useFetchClient();
	const oidc_config = option_result_result_flatten(queryResult(useQuery({
		queryFn: () => fetch(oidcConfigURLForIssuer(issuer))
			.then(config => config.json())
			.then(config => {
				const r = openidConfiguration
					.safeParse(config);
				return r.success ?
					Ok(r.data) : Err(r.error)
			}),
		queryKey: ["oidc-config", issuer],
	})));

	const entropy = queryResult(useQuery({
		queryKey: ['useoidc state', issuer],
		queryFn: fetchEntropy,
		staleTime: Infinity
	}));

	const targetURL = option_result_result_flatten(option_result_zipped(
		oidc_config,
		entropy,
		(v, entropy) => {
			const ep = v.authorization_endpoint[0];

			if (ep === undefined) return Err(
				new Error('auth endpoint missing')
			)

			const authRq: OIDCAuthenticationRequest = {
				response_type: 'id_token',
				client_id: oauthClient.clientId,
				redirect_uri: `${window.location.origin}/callback`,
				scope: 'openid',
				state: entropy,
			};

			const validation = validateAuthenticationRequest(authRq, v);

			if (option.is_some(validation)) {
				return Err(option.unwrap_unchecked(validation))
			}

			const u = new URL(ep);
			u.search = (new URLSearchParams(authRq)).toString();
			return Ok(u);
		}
	));

	const [ callback, requestCallback ] = useWindowCallback();

	const requestConsent = option_result_and_then(
		targetURL, u => () => requestCallback(u)
	);


	const id_token = option_result_result_flatten(option_result_zipped(
		callback,
		entropy,
		(v, entropy) => {
			const callbackHref = new URL(v);
			const paramsZ =
				OIDCAuthenticationResponse.safeParse(
					Object.fromEntries([...callbackHref.searchParams])
				);

			if (!paramsZ.success) return Err(paramsZ.error);

			// this should be a fixed-time string comparison
			// but all the fixed-time string comparisons are
			// promises in webcrypto and if I have to do that
			// rn I may kms
			if (paramsZ.data.state != entropy) return Err(
				new Error('incorrect state challenge')
			)

			if ('error' in paramsZ.data) return Err(
				new Error(paramsZ.data.error)
			);

			if (paramsZ.data.id_token === undefined)
				return Err(new Error('missing id_token in response'));

			return Ok(paramsZ.data.id_token)
		}
	))

	const request_body = option_result_and_then(
		id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	)

	const exchangedTokenRsp = option_result_option_result_flatten(queryResult(useQuery({
		queryKey: ['oidc-exchange-token', id_token],
		queryFn: () => option_result_promise_transpose(option_result_and_then(
			request_body,
			body => apiFetchClient.POST('/oauth2/token', {
				body
			})
		)),
		staleTime: 100 * 60 * 55 // idk
	})));

	const exchangedTokenA = option_result_and_then(
		exchangedTokenRsp,
		v => v.error ? Err(new Error(v.error.error)) : Ok(v.data.access_token)
	);

	const exchangedToken = option.and_then(
		exchangedTokenA,
		v => result.flatten(v)
	)

	return [exchangedToken, requestConsent];
}
