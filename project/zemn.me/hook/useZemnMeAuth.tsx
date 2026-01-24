import { SkipToken, skipToken, useQuery } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { useGoogleAuth } from '#root/project/zemn.me/hook/useGoogleAuth.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { future_and_then, future_declare_dependency } from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';





export function useZemnMeAuth() {
	const apiFetchClient = useFetchClient();
	const [fut_id_token, fut_google_access_token, fut_promptForLogin] = useGoogleAuth([
	]);

	const request_body = future_and_then(
		fut_id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	);



	const exchangedTokenRsp = useQueryFuture(useQuery({
		queryKey: ['zemn-me-oidc-id-token'],
		queryFn: request_body(
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
			}),
			(() => skipToken) as (() => SkipToken),
			(() => skipToken) as (() => SkipToken),
		),
		staleTime: 100 * 60 * 55 // idk
	}));

	const exchangedToken = future_declare_dependency(
		request_body,
		exchangedTokenRsp
	)

	return [exchangedToken, fut_google_access_token, fut_promptForLogin] as const;
}
