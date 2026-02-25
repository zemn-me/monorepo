import { useQuery, useQueryClient } from "@tanstack/react-query";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen.js";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";
import { watchOutParseIdToken } from "#root/ts/oidc/oidc.js";

function extractIdTokenJti(id_token: string) {
	const parsed = watchOutParseIdToken.safeParse(id_token);
	if (!parsed.success) {
		return undefined;
	}

	return parsed.data.jti;
}

export function useFetchClient(id_token?: string) {
	return useMemo(
		() =>
			createFetchClient<paths>({
				baseUrl: ZEMN_ME_API_BASE,
				headers: {
					Authorization: id_token ?? undefined,
				},
			}),
		[id_token],
	);
}

export function useZemnMeApi(id_token?: string) {
	const fetchClient = useFetchClient(id_token);

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

export function useGetGrievances(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	return useQuery({
		queryKey: ["get", "/grievances"],
		queryFn: async () => {
			const v = await fetchClient.GET("/grievances");
			return v.data;
		},
		enabled: id_token !== "",
	});
}

export function useGetAdminUid(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(() => extractIdTokenJti(id_token), [id_token]);
	return useQuery({
		queryKey: ["get", "/admin/uid", jti],
		queryFn: async () => {
			const resp = await fetchClient.GET("/admin/uid");
			if (!resp.data) {
				throw new Error("/admin/uid returned unexpected payload");
			}
			return resp.data.uid;
		},
		enabled: id_token !== "",
	});
}

export function useGetAdminUsers(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(() => extractIdTokenJti(id_token), [id_token]);
	return useQuery({
		queryKey: ["get", "/admin/users", jti],
		queryFn: async () => {
			const resp = await fetchClient.GET("/admin/users");
			if (!resp.data) {
				throw new Error("/admin/users returned unexpected payload");
			}
			return resp.data;
		},
		enabled: id_token !== "",
	});
}

function useinvalidateGrievances() {
	const queryClient = useQueryClient();
	return () => void queryClient.invalidateQueries({ queryKey: ["get", "/grievances"] });
}

function useinvalidateAdminUsers() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ["get", "/admin/users"],
		});
}

export function usePostGrievances(id_token: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(id_token).useMutation("post", "/grievances", {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function useDeleteGrievances(id_token: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(id_token).useMutation("delete", "/grievance/{id}", {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function usePostAdminUsers(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	return useZemnMeApi(id_token).useMutation("post", "/admin/users", {
		onSuccess: () => void invalidateAdminUsers(),
	});
}

export function usePutAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	return useZemnMeApi(id_token).useMutation("put", "/admin/user", {
		onSuccess: () => void invalidateAdminUsers(),
	});
}

export function useDeleteAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	return useZemnMeApi(id_token).useMutation("delete", "/admin/user", {
		onSuccess: () => void invalidateAdminUsers(),
	});
}
