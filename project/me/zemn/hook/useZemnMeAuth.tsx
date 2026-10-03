import { SkipToken, skipToken, useQuery } from '@tanstack/react-query';
import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { useServerSession } from '#root/project/me/zemn/hook/server_session.js';
import { updateSessionCookie } from '#root/project/me/zemn/hook/session_cookie.js';
import { useGoogleAuth } from '#root/project/me/zemn/hook/useGoogleAuth.js';
import { useFetchClient } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import {
	future_and_then,
	future_declare_dependency,
} from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { watchOutParseIdToken } from '#root/ts/oidc/oidc.js';
import { option_from_maybe_undefined } from '#root/ts/option/types.js';

export function useZemnMeAuth() {
	const apiFetchClient = useFetchClient();
	const [
		fut_id_token,
		fut_google_access_token,
		fut_promptForLogin,
		cacheKey,
		sessionControls,
	] = useGoogleAuth([]);

	const request_body = future_and_then(
		fut_id_token,
		(id_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token: id_token,
		})
	);

	const exchangedTokenRsp = useQueryFuture(
		useQuery({
			gcTime: Infinity, // don't evict auth tokens
			queryKey: ['zemn-me-oidc-id-token', ...cacheKey],
			queryFn: request_body(
				body => () =>
					apiFetchClient
						.POST('/oauth2/token', {
							body,
							headers: {
								'Content-Type':
									'application/x-www-form-urlencoded',
							},
						})
						.then(response => {
							if (response.error !== undefined) {
								throw new Error(response.error.error);
							}

							return response.data;
						}),
				(() => skipToken) as () => SkipToken,
				(() => skipToken) as () => SkipToken
			),
			staleTime: r =>
				option_from_maybe_undefined(r.state.data?.expires_in)(
					(/*None*/) => 0,
					v => v * 1000
				),
		})
	);

	const access_token = future_and_then(
		exchangedTokenRsp,
		r => r.access_token
	);

	const exchangedToken = future_declare_dependency(
		request_body,
		access_token
	);

	const { clear } = useServerSession();
	const token = exchangedToken(
		value => value,
		() => undefined,
		() => undefined
	);
	const tokenID =
		token === undefined
			? undefined
			: watchOutParseIdToken.safeParse(token).data?.jti;
	// Mirror the persisted React Query credential without gating browser API access.
	useQuery({
		queryKey: ['authorization-cookie', ...cacheKey, tokenID],
		queryFn:
			token === undefined
				? skipToken
				: ({ signal }) => updateSessionCookie(token, signal),
		staleTime: Infinity,
		// Session cookies must be checked again after a document load; don't persist
		// a successful write as proof that a browser still has the cookie.
		meta: { persist: false },
	});
	const controls = {
		logout: async () => {
			clear();
			sessionControls.logout();
			await updateSessionCookie(null);
		},
		switchUser: () => {
			clear();
			// Open the account picker during the click, before awaiting any I/O.
			const login = sessionControls.switchUser();
			const cleared = updateSessionCookie(null);
			return Promise.all([cleared, login]).then(() => undefined);
		},
	};

	return [
		exchangedToken,
		fut_google_access_token,
		fut_promptForLogin,
		controls,
	] as const;
}
