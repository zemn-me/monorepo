import { useQuery, useQueryClient } from "@tanstack/react-query";
import createFetchClient from "openapi-fetch";
import createClient from "openapi-react-query";
import { useMemo } from 'react';

import type { paths } from "#root/project/zemn.me/api/api_client.gen.js";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";
import { Future, future_and_then, future_declare_dependency } from "#root/ts/future/future.js";
import { useQueryFuture } from "#root/ts/future/react-query/useQuery.js";
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

export function useGetMeScopes<L, E>(id_token: Future<string, L, E>) {
	const fetchClient = useFetchClient(
		id_token(
			token => token,
			() => undefined,
			() => undefined
		));

	const jti = future_and_then(
		id_token,
		tok => extractIdTokenJti(tok)
	)

	const qr = useQuery({
		queryKey: ["get", "/me/scopes", jti(
			j => j,
			() => undefined,
			() => undefined,
		)],
		queryFn: async () => {
			const resp = await fetchClient.GET("/me/scopes");
			if (!resp.data) {
				throw new Error("/me/scopes returned unexpected payload");
			}
			return resp.data.scopes;
		},
		enabled: id_token(
			() => true, () => false, () => false
		),
	});

	return future_declare_dependency(
		id_token,
		useQueryFuture(qr),
	)
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

function useinvalidateMeScopes() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ["get", "/me/scopes"],
		});
}

function useinvalidateCallboxStatus() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ["get", "/callbox"],
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
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation("post", "/admin/users", {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function usePutAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation("put", "/admin/user", {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function useDeleteAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation("delete", "/admin/user", {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function usePostMeKey<A, B>(id_token: Future<string, A, B>) {
	const token = id_token(
		v => v,
		() => undefined,
		() => undefined,
	);
	const invalidateCallboxStatus = useinvalidateCallboxStatus();
	return useZemnMeApi(token).useMutation("post", "/callbox", {
		onSuccess: () => void invalidateCallboxStatus(),
	});
}

export function useGetMeKeyStatus<A, B>(id_token: Future<string, A, B>) {
	const fetchClient = useFetchClient(id_token(
		v => v,
		() => undefined,
		() => undefined,
	));
	const jti = future_and_then(id_token, tok => extractIdTokenJti(tok));
	const q = useQuery({
		queryKey: ["get", "/callbox", jti(
			v => v,
			() => undefined,
			() => undefined,
		)],
		queryFn: async () => {
			const resp = await fetchClient.GET("/callbox");
			if (!resp.data) {
				throw new Error("/callbox returned unexpected payload");
			}
			return resp.data;
		},
		enabled: id_token(
			() => true,
			() => false,
			() => false,
		),
		refetchInterval: 1000,
	});

	return future_declare_dependency(
		id_token,
		useQueryFuture(q)
	)
}
