import { dehydrate, QueryClient } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
	Links,
	type LoaderFunctionArgs,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from 'react-router';
import { DocumentMeta } from '#root/ts/remix/metadata.js';
import { API, apiOrigin } from './api.js';
import { Providers } from './providers.js';
import { apiContext } from './server-context.js';
import './style.css';

export { ErrorBoundary } from '#root/ts/remix/error.js';

export async function loader({ context, request }: LoaderFunctionArgs) {
	const config =
		context.get(apiContext) ??
		(process.env.NODE_ENV === 'development'
			? {
					apiOrigin:
						process.env.API_ORIGIN ??
						apiOrigin(new URL(request.url).origin),
				}
			: undefined);
	if (!config) throw new Error('API origin is not configured');
	const { apiOrigin: origin, apiFetchOrigin } = config;
	if (typeof origin !== 'string')
		throw new Error('API origin is not configured');
	const api = new API(origin);
	const client = new QueryClient();
	try {
		// A request-scoped cache contains public archive data only. Author cookies
		// stay on the separate API host and are never forwarded by the renderer.
		const options = api.issues();
		await client.fetchQuery({
			...options,
			queryFn: async () => {
				const response = await api.fetchClient.GET('/api/issues', {
					baseUrl:
						typeof apiFetchOrigin === 'string'
							? apiFetchOrigin
							: origin,
					credentials: 'omit',
					signal: AbortSignal.any([
						request.signal,
						AbortSignal.timeout(5000),
					]),
				});
				if (!response.data) throw new Error('Archive unavailable');
				return response.data;
			},
			retry: false,
		});
		return { apiOrigin: origin, dehydratedState: dehydrate(client) };
	} catch {
		throw new Response(
			'The archive is temporarily unavailable. Please try again.',
			{ status: 503 }
		);
	} finally {
		client.clear();
	}
}

export function Layout({ children }: { children: ReactNode }) {
	const initial = useRouteLoaderData<typeof loader>('root');
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<meta name="referrer" content="no-referrer" />
				<DocumentMeta />
				<Links />
			</head>
			<body>
				<Providers initial={initial}>{children}</Providers>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
export default function App() {
	return <Outlet />;
}
export const handle = {
	metadata: {
		title: {
			default: 'The Bowery Bugle',
			template: '%s · The Bowery Bugle',
		},
		description: 'The Bowery Bugle. Read the print issues.',
	},
};
