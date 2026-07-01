import { SkipToken, skipToken, useQuery } from '@tanstack/react-query';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { DISCORD_CLIENT_ID } from '#root/project/me/zemn/constants/constants.js';
import { useDiscordAuth } from '#root/project/me/zemn/hook/useDiscordAuth.js';
import { useGoogleAuth } from '#root/project/me/zemn/hook/useGoogleAuth.js';
import { useFetchClient } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import {
	future_and_then,
	future_declare_dependency,
} from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { option_from_maybe_undefined } from '#root/ts/option/types.js';

export type ZemnMeAuthProvider = 'google' | 'discord';

export function useZemnMeAuth(provider: ZemnMeAuthProvider = 'google') {
	const apiFetchClient = useFetchClient();
	const googleAuth = useGoogleAuth([]);
	const discordAuth = useDiscordAuth();
	const [
		fut_google_id_token,
		fut_google_access_token,
		fut_google_promptForLogin,
		googleCacheKey,
	] = googleAuth;
	const [
		fut_discord_access_token,
		fut_discord_promptForLogin,
		discordCacheKey,
	] = discordAuth;

	const fut_subject_token =
		provider === 'discord'
			? fut_discord_access_token
			: fut_google_id_token;
	const fut_provider_access_token =
		provider === 'discord'
			? fut_discord_access_token
			: fut_google_access_token;
	const fut_promptForLogin =
		provider === 'discord'
			? fut_discord_promptForLogin
			: fut_google_promptForLogin;
	const cacheKey = provider === 'discord' ? discordCacheKey : googleCacheKey;
	const subjectTokenType =
		provider === 'discord'
			? 'urn:ietf:params:oauth:token-type:access_token'
			: 'urn:ietf:params:oauth:token-type:id_token';

	const request_body = future_and_then(
		fut_subject_token,
		(subject_token: string): components['schemas']['TokenExchangeRequest'] => ({
			grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
			requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
			subject_token_type: subjectTokenType,
			subject_token,
			...(provider === 'discord' && DISCORD_CLIENT_ID !== undefined
				? { client_id: DISCORD_CLIENT_ID }
				: {}),
		})
	);

	const exchangedTokenRsp = useQueryFuture(
		useQuery({
			gcTime: Infinity, // don't evict auth tokens
			queryKey: ['zemn-me-oidc-id-token', provider, ...cacheKey],
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

	return [
		exchangedToken,
		fut_provider_access_token,
		fut_promptForLogin,
	] as const;
}
