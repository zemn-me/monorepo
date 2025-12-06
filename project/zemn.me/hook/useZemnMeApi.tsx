import { useQuery, useQueryClient } from "@tanstack/react-query";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { components, paths } from "#root/project/zemn.me/api/api_client.gen.js";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";
import { EOAuthError } from "#root/ts/oidc/error.js";
import * as future from "#root/ts/result/react-query/future.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";

export function useFetchClient(Authorization?: string) {
	return useMemo(
		() =>
			createFetchClient<paths>({
				baseUrl: ZEMN_ME_API_BASE,
				headers: {
					Authorization: Authorization ?? undefined,
				},
			}),
		[Authorization],
	);
}

export function useZemnMeApi(Authorization?: string) {
	const fetchClient = useFetchClient(Authorization);

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

export function useGetGrievances(Authorization: string) {
	const fetchClient = useFetchClient(Authorization);
	return useQuery({
		queryKey: ["get", "/grievances"],
		queryFn: async () => {
			const v = await fetchClient.GET("/grievances");
			return v.data;
		},
		enabled: Authorization !== "",
	});
}

export function useGetAdminUid(Authorization: string) {
	const fetchClient = useFetchClient(Authorization);
	return useQuery({
		queryKey: ["get", "/admin/uid", Authorization],
		queryFn: async () => {
			const resp = await fetchClient.GET("/admin/uid");
			if (!resp.data) {
				throw new Error("/admin/uid returned unexpected payload");
			}
			return resp.data.uid;
		},
		enabled: Authorization !== "",
	});
}

function useinvalidateGrievances() {
	const queryClient = useQueryClient();
	return () => void queryClient.invalidateQueries({ queryKey: ["get", "/grievances"] });
}

export function usePostGrievances(Authorization: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(Authorization).useMutation("post", "/grievances", {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function useDeleteGrievances(Authorization: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(Authorization).useMutation("delete", "/grievance/{id}", {
		onSuccess: () => void invalidateGrievances(),
	});
}

/**
 * Hits the exchange token endpoint and automatically
 * sets up expiry.
 */
export function useExchangeToken<E>(
	params: future.Future<
		components['schemas']['TokenExchangeRequest']
	, E>,
	queryKey: string[],
) {
	const fetchClient = useFetchClient();
	const r = queryResult(useQuery({
		queryFn: future.or_skip_query(
			future.and_then(
				params,
				p =>
					async () => {
						const resp = await fetchClient.POST('/oauth2/token', {
							body: p,
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded',
							}
						})


						return resp;
					}
			)
		),
		queryKey: queryKey,
		staleTime: s => (s.state.data?.data?.expires_in ?? 0) * 1000
	}));

	return future.and_then_flatten(
		r,
		v =>
			v.error?
				future.error(new EOAuthError(v.error))
				:future.success(v.data)
	)
}
