import { skipToken, useQuery } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { FOREIGN_ID_TOKEN_ISSUER } from '#root/project/zemn.me/constants/constants.js';
import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { Option } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';



export type useZemnMeAuthReturnType = [
	access_token: Option<string>,
	promptForLogin: Option<() => Promise<void>>,
];

export function useZemnMeAuth(): useZemnMeAuthReturnType {
	const issuer = FOREIGN_ID_TOKEN_ISSUER;
	const apiFetchClient = useFetchClient();
	const [id_token, promptForLogin] = useOIDC(issuer, []);

	const request_body = option.and_then(
		id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	);

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
			: option.None;

	return [exchangedToken, promptForLogin];
}
