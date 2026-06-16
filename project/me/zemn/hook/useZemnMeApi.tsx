import {
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import { useMemo } from 'react';

import type { paths } from '#root/project/me/zemn/api/api_client.gen.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import {
	Future,
	future_and_then,
	future_declare_dependency,
	resolve,
} from '#root/ts/future/future.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';
import { noop } from '#root/ts/noop.js';
import { watchOutParseIdToken } from '#root/ts/oidc/oidc.js';

export type AnalyticsEvent =
	paths['/analytics/beacon']['post']['requestBody']['content']['application/json'];

export async function sendAnalyticsBeacon(
	event: AnalyticsEvent
): Promise<boolean> {
	const client = createFetchClient<paths>({
		baseUrl: ZEMN_ME_API_BASE,
	});
	const response = await client.POST('/analytics/beacon', {
		body: event,
		credentials: 'omit',
		keepalive: true,
		headers: {
			'Content-Type': 'application/json',
		},
	});

	return response.response.ok;
}

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
		[id_token]
	);
}

export function useFetchClientFuture<A, B>(id_token: Future<string, A, B>) {
	return future_declare_dependency(
		id_token,
		resolve(
			useFetchClient(
				id_token(
					v => v,
					() => undefined,
					() => undefined
				)
			)
		)
	);
}

export function useZemnMeApi(id_token?: string) {
	const fetchClient = useFetchClient(id_token);

	return useMemo(() => createClient(fetchClient), [fetchClient]);
}

function calendarICalURL(email: string) {
	return new URL(
		`/calendar/ical/${encodeURIComponent(email)}`,
		ZEMN_ME_API_BASE
	).toString();
}

function getCalendarICalQuery(email: string) {
	return {
		queryKey: ['get', '/calendar/ical/{email}', email],
		queryFn: async () => {
			const response = await fetch(calendarICalURL(email));
			if (!response.ok) {
				throw new Error(`/calendar/ical/{email}: ${response.status}`);
			}
			return response.text();
		},
		enabled: email !== '',
	};
}

export function useGetCalendarICal(email: string) {
	return useQueryFuture(useQuery(getCalendarICalQuery(email)));
}

export function useGetCalendarICals(emails: readonly string[]) {
	return useQueries({
		queries: emails.map(email => getCalendarICalQuery(email)),
	}).map(useQueryFuture);
}

export function useGetGrievances(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	return useQuery({
		queryKey: ['get', '/grievances'],
		queryFn: async () => {
			const v = await fetchClient.GET('/grievances');
			return v.data;
		},
		enabled: id_token !== '',
	});
}

export function useGetAdminUid(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(() => extractIdTokenJti(id_token), [id_token]);
	return useQuery({
		queryKey: ['get', '/admin/uid', jti],
		queryFn: async () => {
			const resp = await fetchClient.GET('/admin/uid');
			if (!resp.data) {
				throw new Error('/admin/uid returned unexpected payload');
			}
			return resp.data.uid;
		},
		enabled: id_token !== '',
	});
}

export function useGetAdminUsers(id_token: string) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(() => extractIdTokenJti(id_token), [id_token]);
	return useQuery({
		queryKey: ['get', '/admin/users', jti],
		queryFn: async () => {
			const resp = await fetchClient.GET('/admin/users');
			if (!resp.data) {
				throw new Error('/admin/users returned unexpected payload');
			}
			return resp.data;
		},
		enabled: id_token !== '',
	});
}

export function useGetAdminAnalyticsEvents(
	id_token: string,
	cursor?: string,
	limit = 25
) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(() => extractIdTokenJti(id_token), [id_token]);
	return useQuery({
		queryKey: ['get', '/admin/analytics/events', jti, cursor, limit],
		queryFn: async () => {
			const resp = await fetchClient.GET('/admin/analytics/events', {
				params: {
					query: {
						cursor,
						limit,
					},
				},
			});
			if (!resp.data) {
				throw new Error(
					'/admin/analytics/events returned unexpected payload'
				);
			}
			return resp.data;
		},
		enabled: id_token !== '',
	});
}

export function useGetMeScopes<L, E>(id_token: Future<string, L, E>) {
	const fetchClient = useFetchClient(
		id_token(
			token => token,
			() => undefined,
			() => undefined
		)
	);

	const jti = future_and_then(id_token, tok => extractIdTokenJti(tok));

	const qr = useQuery({
		queryKey: [
			'get',
			'/me/scopes',
			jti(
				j => j,
				() => undefined,
				() => undefined
			),
		],
		queryFn: async () => {
			const resp = await fetchClient.GET('/me/scopes');
			if (!resp.data) {
				throw new Error('/me/scopes returned unexpected payload');
			}
			return resp.data.scopes;
		},
		enabled: id_token(
			() => true,
			() => false,
			() => false
		),
	});

	return future_declare_dependency(id_token, useQueryFuture(qr));
}

function useinvalidateGrievances() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/grievances'],
		});
}

function useinvalidateAdminUsers() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/admin/users'],
		});
}

function useinvalidateMeScopes() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/me/scopes'],
		});
}

function useinvalidateCallboxStatus() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/callbox'],
		});
}

function useinvalidateCallboxEvents() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/callbox/events'],
		});
}

function useinvalidateMinecraftWhitelist() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/minecraft/whitelist'],
		});
}

function useinvalidateMinecraftStatus() {
	const queryClient = useQueryClient();
	return () =>
		void queryClient.invalidateQueries({
			queryKey: ['get', '/minecraft/status'],
		});
}

export function usePostGrievances(id_token: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(id_token).useMutation('post', '/grievances', {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function useDeleteGrievances(id_token: string) {
	const invalidateGrievances = useinvalidateGrievances();
	return useZemnMeApi(id_token).useMutation('delete', '/grievance/{id}', {
		onSuccess: () => void invalidateGrievances(),
	});
}

export function usePostAdminUsers(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation('post', '/admin/users', {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function usePutAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation('put', '/admin/user', {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function useDeleteAdminUser(id_token: string) {
	const invalidateAdminUsers = useinvalidateAdminUsers();
	const invalidateMeScopes = useinvalidateMeScopes();
	return useZemnMeApi(id_token).useMutation('delete', '/admin/user', {
		onSuccess: () => {
			void invalidateAdminUsers();
			void invalidateMeScopes();
		},
	});
}

export function usePostMeKey<A, B>(
	id_token: Future<string, A, B>,
	onMutate: () => void = noop,
	onSuccess: () => void = noop,
	onError: () => void = noop
) {
	const fetchClient = useFetchClientFuture(id_token);
	const invalidateCallboxStatus = useinvalidateCallboxStatus();
	const invalidateCallboxEvents = useinvalidateCallboxEvents();
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: [
			'post',
			'/callbox',
			id_token(
				tok => extractIdTokenJti(tok),
				() => undefined,
				() => undefined
			),
		],

		mutationFn: fetchClient(
			cl => (open: boolean) =>
				cl.POST('/callbox', {
					body: {
						open,
					},
				}),
			// i think in some edge cases this might happen
			// in future this function will itself return a future
			// so it can actuall never happen
			() => (_open: boolean) => {
				throw new Error('this should never happen');
			},
			() => (_open: boolean) => {
				throw new Error('this should never happen');
			}
		),

		onMutate: open => {
			onMutate();
			// eagerly assume the query will succeed.
			queryClient.setQueryData(
				[
					'get',
					'/callbox',
					id_token(
						tok => extractIdTokenJti(tok),
						() => undefined,
						() => undefined
					),
				],
				(): GetCallboxStatusSuccessResponse => ({
					open,
				})
			);
		},

		onSuccess: () => {
			// sync with server
			invalidateCallboxStatus();
			invalidateCallboxEvents();
			onSuccess();
		},

		onError: onError,
	});
}

export type GetCallboxStatusSuccessResponse =
	paths['/callbox']['get']['responses']['200']['content']['application/json'];

export type GetCallboxEventsSuccessResponse =
	paths['/callbox/events']['get']['responses']['200']['content']['application/json'];

export type CallboxEvent = GetCallboxEventsSuccessResponse['events'][number];

export type GetMinecraftStatusSuccessResponse =
	paths['/minecraft/status']['get']['responses']['200']['content']['application/json'];

export type GetMinecraftWhitelistSuccessResponse =
	paths['/minecraft/whitelist']['get']['responses']['200']['content']['application/json'];

export type PostMinecraftWakeSuccessResponse =
	paths['/minecraft/wake']['post']['responses']['202']['content']['application/json'];

export function useGetMinecraftStatus<A, B>(id_token: Future<string, A, B>) {
	const fetchClient = useFetchClient(
		id_token(
			v => v,
			() => undefined,
			() => undefined
		)
	);
	const jti = future_and_then(id_token, tok => extractIdTokenJti(tok));
	const q = useQuery({
		queryKey: [
			'get',
			'/minecraft/status',
			jti(
				v => v,
				() => undefined,
				() => undefined
			),
		],
		queryFn: async () => {
			const resp = await fetchClient.GET('/minecraft/status');
			if (!resp.data) {
				throw new Error('/minecraft/status returned unexpected payload');
			}
			return resp.data;
		},
		enabled: id_token(
			() => true,
			() => false,
			() => false
		),
		refetchInterval: 5000,
	});

	return future_declare_dependency(id_token, useQueryFuture(q));
}

export function usePostMinecraftWake<A, B>(
	id_token: Future<string, A, B>,
	onSuccess: () => void = noop,
	onError: () => void = noop
) {
	const fetchClient = useFetchClientFuture(id_token);
	const invalidateMinecraftStatus = useinvalidateMinecraftStatus();

	return useMutation({
		mutationKey: [
			'post',
			'/minecraft/wake',
			id_token(
				tok => extractIdTokenJti(tok),
				() => undefined,
				() => undefined
			),
		],
		mutationFn: fetchClient(
			cl => async () => {
				const resp = await cl.POST('/minecraft/wake');
				if (!resp.data) {
					const cause =
						typeof resp.error === 'object' &&
						resp.error !== null &&
						'cause' in resp.error &&
						typeof resp.error.cause === 'string'
							? resp.error.cause
							: '/minecraft/wake returned unexpected payload';
					throw new Error(cause);
				}
				return resp.data;
			},
			() => () => {
				throw new Error('this should never happen');
			},
			() => () => {
				throw new Error('this should never happen');
			}
		),
		onSuccess: () => {
			invalidateMinecraftStatus();
			onSuccess();
		},
		onError,
	});
}

export function useGetMinecraftWhitelist<A, B>(
	id_token: Future<string, A, B>
) {
	const fetchClient = useFetchClient(
		id_token(
			v => v,
			() => undefined,
			() => undefined
		)
	);
	const jti = future_and_then(id_token, tok => extractIdTokenJti(tok));
	const q = useQuery({
		queryKey: [
			'get',
			'/minecraft/whitelist',
			jti(
				v => v,
				() => undefined,
				() => undefined
			),
		],
		queryFn: async () => {
			const resp = await fetchClient.GET('/minecraft/whitelist');
			if (!resp.data) {
				throw new Error(
					'/minecraft/whitelist returned unexpected payload'
				);
			}
			return resp.data;
		},
		enabled: id_token(
			() => true,
			() => false,
			() => false
		),
	});

	return future_declare_dependency(id_token, useQueryFuture(q));
}

export function usePutMinecraftWhitelist<A, B>(
	id_token: Future<string, A, B>,
	onSuccess: () => void = noop,
	onError: () => void = noop
) {
	const fetchClient = useFetchClientFuture(id_token);
	const invalidateMinecraftWhitelist = useinvalidateMinecraftWhitelist();

	return useMutation({
		mutationKey: [
			'put',
			'/minecraft/whitelist',
			id_token(
				tok => extractIdTokenJti(tok),
				() => undefined,
				() => undefined
			),
		],
		mutationFn: fetchClient(
			cl => async (username: string) => {
				const resp = await cl.PUT('/minecraft/whitelist', {
					body: { username },
				});
				if (!resp.data) {
					const cause =
						typeof resp.error === 'object' &&
						resp.error !== null &&
						'cause' in resp.error &&
						typeof resp.error.cause === 'string'
							? resp.error.cause
							: '/minecraft/whitelist returned unexpected payload';
					throw new Error(cause);
				}
				return resp.data;
			},
			() => (_username: string) => {
				throw new Error('this should never happen');
			},
			() => (_username: string) => {
				throw new Error('this should never happen');
			}
		),
		onSuccess: () => {
			invalidateMinecraftWhitelist();
			onSuccess();
		},
		onError,
	});
}

export function useGetMeKeyStatus<A, B>(id_token: Future<string, A, B>) {
	const fetchClient = useFetchClient(
		id_token(
			v => v,
			() => undefined,
			() => undefined
		)
	);
	const jti = future_and_then(id_token, tok => extractIdTokenJti(tok));
	const q = useQuery({
		queryKey: [
			'get',
			'/callbox',
			jti(
				v => v,
				() => undefined,
				() => undefined
			),
		],
		queryFn: async () => {
			const resp = await fetchClient.GET('/callbox');
			if (!resp.data) {
				throw new Error('/callbox returned unexpected payload');
			}
			return resp.data;
		},
		enabled: id_token(
			() => true,
			() => false,
			() => false
		),
		refetchInterval: 1000,
	});

	return future_declare_dependency(id_token, useQueryFuture(q));
}

export function useGetCallboxEventsForToken(
	id_token: string | undefined,
	limit = 32
) {
	const fetchClient = useFetchClient(id_token);
	const jti = useMemo(
		() => (id_token ? extractIdTokenJti(id_token) : undefined),
		[id_token]
	);
	return useInfiniteQuery({
		queryKey: ['get', '/callbox/events', limit, jti],
		queryFn: async ({ pageParam }) => {
			const resp = await fetchClient.GET('/callbox/events', {
				params: {
					query: {
						cursor: pageParam,
						limit,
					},
				},
			});
			if (!resp.data) {
				throw new Error('/callbox/events returned unexpected payload');
			}
			return resp.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: lastPage => lastPage.nextCursor,
		placeholderData: previousData => previousData,
		enabled: Boolean(id_token),
	});
}
