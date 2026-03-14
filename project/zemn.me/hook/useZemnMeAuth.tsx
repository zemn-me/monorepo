import { Query, QueryClient, SkipToken, skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '#root/project/zemn.me/api/api_client.gen.js';
import { useGoogleAuth } from '#root/project/zemn.me/hook/useGoogleAuth.js';
import { useFetchClient } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { future_and_then, future_declare_dependency } from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { option_from_maybe_undefined } from '#root/ts/option/types.js';

export const useOIDCQueryKeyPrefix = 'use-oidc';
export const useZemnMeAuthQueryKeyPrefix = 'zemn-me-oidc-id-token';
export const persistedQueryClientStorageKey = 'REACT_QUERY_OFFLINE_CACHE';

export function isZemnMeAuthQuery(query: Pick<Query, 'queryKey'>): boolean {
	return (
		query.queryKey[0] === useZemnMeAuthQueryKeyPrefix ||
		query.queryKey[0] === useOIDCQueryKeyPrefix
	);
}

type PersistedQueryClientRecord = {
	timestamp: number;
	buster: string;
	clientState: {
		mutations: unknown[];
		queries: Array<{
			queryKey: unknown[];
		}>;
	};
};

function isPersistedQueryClientRecord(value: unknown): value is PersistedQueryClientRecord {
	if (typeof value !== 'object' || value === null) return false;

	const maybe = value as Partial<PersistedQueryClientRecord>;
	return (
		typeof maybe.timestamp === 'number' &&
		typeof maybe.buster === 'string' &&
		typeof maybe.clientState === 'object' &&
		maybe.clientState !== null &&
		Array.isArray((maybe.clientState as { mutations?: unknown[] }).mutations) &&
		Array.isArray((maybe.clientState as { queries?: unknown[] }).queries)
	);
}

export function withoutPersistedZemnMeAuth(value: unknown): unknown {
	if (!isPersistedQueryClientRecord(value)) return value;

	return {
		...value,
		clientState: {
			...value.clientState,
			queries: value.clientState.queries.filter(
				query =>
					!Array.isArray(query.queryKey) ||
					!isZemnMeAuthQuery({ queryKey: query.queryKey }),
			),
		},
	};
}

export function prunePersistedZemnMeAuth(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	key = persistedQueryClientStorageKey,
) {
	const persisted = storage.getItem(key);
	if (persisted === null) return;

	const filtered = withoutPersistedZemnMeAuth(JSON.parse(persisted));
	storage.setItem(key, JSON.stringify(filtered));
}

export function clearZemnMeAuth(
	client: Pick<QueryClient, 'cancelQueries' | 'removeQueries'>,
	storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
) {
	client.cancelQueries({
		predicate: isZemnMeAuthQuery,
	});
	client.removeQueries({
		predicate: isZemnMeAuthQuery,
	});
	prunePersistedZemnMeAuth(storage);
}

export function useClearZemnMeAuth() {
	const client = useQueryClient();
	return () => clearZemnMeAuth(client);
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
		gcTime: Infinity,
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
			() => 0,
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
	);

	return [exchangedToken, fut_google_access_token, fut_promptForLogin] as const;
}
