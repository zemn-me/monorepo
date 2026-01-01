
import { skipToken, useQuery } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { FOREIGN_ID_TOKEN_ISSUER } from '#root/project/zemn.me/constants/constants.js';
import { useGoogleOIDC } from '#root/project/zemn.me/hook/useGoogleOIDC.js';
import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';
import { useOIDCConfig } from '#root/project/zemn.me/hook/useOIDCConfig.js';
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
import * as result from '#root/ts/result/result.js';




export function useZemnMeOIDC(
	issuer: string,
	scopes: string[],
): useOIDCReturnType {

	const googleToken = useGoogleOIDC([]);



	const callbackV = option.and_then(
		callback,
		v => result.unwrap(v)
	)

	const authResponse = option.and_then(
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

	if (entropy.status === "success")
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
		)

	const id_token = option.and_then(
		authSuccessResponse,
		v =>
			result.unwrap(
				v.id_token !== undefined
					? result.Ok(v.id_token)
					: result.Err(new Error('missing id_token'))
			)
	);

	const request_body = option.and_then(
		id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	)

	const exchangeQueryFn = option.and_then(
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
		queryKey: ['oidc-id-token', issuer],
		queryFn: option.unwrap_or(exchangeQueryFn, skipToken),
		staleTime: 100 * 60 * 55 // idk
	});
	const exchangedToken =
		exchangedTokenRsp.status === 'success'
			? option.Some(exchangedTokenRsp.data)
			: option.None

	return [exchangedToken, requestConsent];
}
