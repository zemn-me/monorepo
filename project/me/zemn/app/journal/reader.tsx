import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import {
	type ClientLoaderFunctionArgs,
	data,
	type LoaderFunctionArgs,
	useLoaderData,
} from 'react-router';
import { JournalReaderLayout } from '#root/project/me/zemn/app/journal/client.js';
import { useSessionClaims } from '#root/project/me/zemn/hook/server_session.js';
import {
	privateHeaders,
	readSession,
} from '#root/project/me/zemn/hook/session.server.js';
import {
	journalWikiQueryKey,
	useFetchClient,
	useGetMeScopes,
} from '#root/project/me/zemn/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';

export const headers = () => privateHeaders;

async function loadWiki(
	client: ReturnType<typeof useFetchClient>,
	jti: string | undefined,
	pageId: string,
	signal: AbortSignal
) {
	const cache = new QueryClient();
	if (pageId === 'all') {
		const response = await client.GET('/journal/wiki', { signal });
		if (!response.data)
			throw data('Wiki unavailable', {
				status: response.response.status,
			});
		cache.setQueryData(journalWikiQueryKey(jti, pageId), response.data);
	} else {
		const response = await client.GET('/journal/wiki/{pageId}', {
			signal,
			params: { path: { pageId } },
		});
		// Keep unavailable entries inside the journal, including the playback controls.
		cache.setQueryData(
			journalWikiQueryKey(jti, pageId),
			response.data ?? null
		);
	}
	return dehydrate(cache);
}

export async function loader({ url, request }: LoaderFunctionArgs) {
	const pageId = url.searchParams.get('wiki');
	if (pageId === null) return null;
	const auth = await readSession(request);
	return data(
		auth?.session.scopes.includes('journal_read')
			? await loadWiki(
					auth.client,
					auth.session.claims.jti,
					pageId,
					request.signal
				)
			: null,
		{ headers: privateHeaders }
	);
}

// A mounted reader can already read the API while its SSR session cookie is
// being established. Hand that same authenticated read to the router.
let browserWikiRead:
	| ((pageId: string, signal: AbortSignal) => ReturnType<typeof loadWiki>)
	| undefined;

export async function clientLoader({
	request,
	serverLoader,
}: ClientLoaderFunctionArgs) {
	const pageId = new URL(request.url).searchParams.get('wiki');
	if (pageId === null) return null;
	return browserWikiRead
		? browserWikiRead(pageId, request.signal)
		: serverLoader<typeof loader>();
}

export default function Reader() {
	const wiki = useLoaderData<typeof loader>();
	const [identity] = useZemnMeAuth();
	const jti = useSessionClaims(identity)?.jti;
	const token = identity(
		value => value,
		() => undefined,
		() => undefined
	);
	const client = useFetchClient(token);
	const canRead = useGetMeScopes(identity)(
		scopes => scopes.includes('journal_read'),
		() => false,
		() => false
	);
	useEffect(() => {
		if (!token || !jti || !canRead) return;
		const read = (pageId: string, signal: AbortSignal) =>
			loadWiki(client, jti, pageId, signal);
		browserWikiRead = read;
		return () => {
			if (browserWikiRead === read) browserWikiRead = undefined;
		};
	}, [token, jti, canRead, client]);
	return (
		<HydrationBoundary state={wiki}>
			<JournalReaderLayout />
		</HydrationBoundary>
	);
}
