import { skipToken, useQuery } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { useGoogleAuth } from '#root/project/zemn.me/hook/useGoogleAuth.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { Option } from '#root/ts/option/types.js';
import * as option from '#root/ts/option/types.js';



export type useZemnMeAuthReturnType = [
	zemn_me_id_token: Option<string>,
	google_access_token: Option<string>,
	promptForLogin: Option<() => Promise<void>>,
];

export function useZemnMeAuth(): useZemnMeAuthReturnType {
	const apiFetchClient = useFetchClient();
	const [id_token, google_access_token, promptForLogin] = useGoogleAuth([
		'https://www.googleapis.com/auth/contacts.readonly',
	]);

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
		queryKey: ['zemn-me-oidc-id-token'],
		queryFn: option.unwrap_or(exchangeQueryFn, skipToken),
		staleTime: 100 * 60 * 55 // idk
	});
	const exchangedToken =
		exchangedTokenRsp.status === 'success'
			? option.Some(exchangedTokenRsp.data)
			: option.None;

	return [exchangedToken, google_access_token, promptForLogin];
}
