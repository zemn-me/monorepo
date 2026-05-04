import { SkipToken, skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { useGoogleAuth } from '#root/project/zemn.me/hook/useGoogleAuth.js';
import { useOIDCQueryKeyPrefix } from '#root/project/zemn.me/hook/useOIDC.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { future_and_then, future_declare_dependency } from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { option_from_maybe_undefined } from '#root/ts/option/types.js';


export const useZemnMeAuthQueryKeyPrefix = 'zemn-me-oidc-id-token';

export function useClearZemnMeAuth() {
	const client = useQueryClient();
	return () => client.invalidateQueries({
		predicate: q => q.queryKey[0] === useZemnMeAuthQueryKeyPrefix || q.queryKey[0] === useOIDCQueryKeyPrefix
	})
}


export function useZemnMeAuth() {
	const apiFetchClient = useFetchClient();
	const [fut_id_token, fut_google_access_token, fut_promptForLogin, cacheKey] = useGoogleAuth([
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
		gcTime: Infinity, // don't evict auth tokens
		queryKey: [useZemnMeAuthQueryKeyPrefix, ...cacheKey],
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

				return response.data;
			}),
			(() => skipToken) as (() => SkipToken),
			(() => skipToken) as (() => SkipToken),
		),
		staleTime: r => option_from_maybe_undefined(
			r.state.data?.expires_in
		)(
			(/*None*/) => 0,
			v => v * 1000
		)

	}));

	const access_token = future_and_then(
		exchangedTokenRsp,
		r => r.access_token
	);

	const exchangedToken = future_declare_dependency(
		request_body,
		access_token,
	)

	return [exchangedToken, fut_google_access_token, fut_promptForLogin] as const;
}
