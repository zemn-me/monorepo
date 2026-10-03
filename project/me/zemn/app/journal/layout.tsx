import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from '@tanstack/react-query';
import {
	data,
	type LoaderFunctionArgs,
	Outlet,
	useLoaderData,
} from 'react-router';
import { JournalRenderTime } from '#root/project/me/zemn/app/journal/render_time.js';
import {
	privateHeaders,
	readSession,
} from '#root/project/me/zemn/hook/session.server.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

export const metadata: Metadata = {
	title: 'Voice journal',
	description: 'A private, transcript-linked voice journal.',
};

export const headers = () => privateHeaders;

export async function loader({ request }: LoaderFunctionArgs) {
	const auth = await readSession(request);
	const queryClient = new QueryClient();
	if (auth?.session.scopes.includes('journal_read')) {
		const response = await auth.client.GET('/journal');
		if (!response.data)
			throw new Response('Journal unavailable', {
				status: response.response.status,
				headers: privateHeaders,
			});
		const journal = response.data;
		const jti = auth.session.claims.jti;
		queryClient.setQueryData(['get', '/journal', jti], journal);
		const pageId = new URL(request.url).searchParams.get('wiki');
		if (pageId && pageId !== 'all') {
			const page = await auth.client.GET('/journal/wiki/{pageId}', {
				params: { path: { pageId } },
			});
			if (page.data)
				queryClient.setQueryData(
					[
						'get',
						'/journal/wiki/{pageId}',
						jti,
						pageId,
						journal.curation?.generation,
					],
					page.data
				);
		}
	}
	return data(
		{ dehydratedState: dehydrate(queryClient), renderedAt: Date.now() },
		{ headers: privateHeaders }
	);
}

export default function Layout() {
	const { dehydratedState, renderedAt } = useLoaderData<typeof loader>();
	return (
		<HydrationBoundary state={dehydratedState}>
			<JournalRenderTime.Provider value={renderedAt}>
				<Outlet />
			</JournalRenderTime.Provider>
		</HydrationBoundary>
	);
}

export const handle = { metadata };
