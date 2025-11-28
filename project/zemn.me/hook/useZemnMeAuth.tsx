import type { components } from "#root/project/zemn.me/api/api_client.gen.js";
import { FOREIGN_ID_TOKEN_ISSUER } from '#root/project/zemn.me/constants/constants.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import {
	OAuthClientByIssuer,
} from '#root/project/zemn.me/OAuth/clients.js';
import { isDefined } from '#root/ts/guard.js';
import { useOIDC as useGenericOIDC } from '#root/ts/oidc/useOIDC.js';
import * as option from '#root/ts/option/types.js';
import * as future from '#root/ts/result/react-query/future.js'
import { useFuture } from '#root/ts/result/react-query/useQuery.js';

const ALL_API_SCOPES = [
	'callbox.read',
	'callbox.write',
	'grievances.read',
	'grievances.write',
	'admin.read',
];

type UseZemnMeAuthOptions = {
	readonly scopes?: readonly string[];
};

class OAuthError extends Error {
	constructor(public readonly data: components['schemas']['OAuthError']) {
		super([
			data.error,
			data.error_description,
			data.error_uri
		].filter(isDefined).join(": "))
	}
}

export function useZemnMeAuth(options: UseZemnMeAuthOptions = {}) {
	const apiScopes = options.scopes ?? ALL_API_SCOPES;
	const issuer = FOREIGN_ID_TOKEN_ISSUER; // foreign issuer
	const oauthClient = OAuthClientByIssuer(issuer);
	const apiFetchClient = useFetchClient();

	// Perform implicit flow against the upstream issuer to obtain an id_token.
	const [, idToken, promptForLogin] = useGenericOIDC(option.Some({
		issuer,
		client_id: oauthClient.clientId,
		response_type: 'code token id_token',
		scope: 'openid',
	}));

	// Exchange the upstream id_token for an api.zemn.me access_token.
	const access_token_request_body = future.and_then(
		idToken,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
			scope: apiScopes.join(' '),
		})
	);

	const access_token_exchange_response_a = useFuture(
		future.and_then(
			access_token_request_body,
			body => ({
				fn: () => apiFetchClient.POST(
					'/oauth2/token', {
					body,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					}
				}),
				key: ['oidc-access-token', issuer, ...apiScopes],
				staleTime: 100 * 60 * 55, // idk
			}),
		)
	)

	const access_token = future.and_then_flatten(
		access_token_exchange_response_a,
		v =>
			v.error?
				future.error(new OAuthError(v.error)) :
				future.success(v.data.access_token),
	)

	// Exchange the upstream id_token for an api.zemn.me access_token.
	const id_token_request_body = future.and_then(
		idToken,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
			scope: apiScopes.join(' '),
		})
	);

	const id_token_exchange_response_a = useFuture(
		future.and_then(
			id_token_request_body,
			body => ({
				fn: () => apiFetchClient.POST(
					'/oauth2/token', {
					body,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					}
				}),
				key: ['oidc-id-token', issuer, ...apiScopes],
				staleTime: 100 * 60 * 55, // idk
			}),
		)
	)

	const id_token = future.and_then_flatten(
		id_token_exchange_response_a,
		v =>
			v.error?
				future.error(new OAuthError(v.error)) :
				future.success(v.data.access_token),
	)

	return [access_token, id_token, promptForLogin] as const;
}
