import {
	type DehydratedState,
	HydrationBoundary,
	QueryClient,
	QueryClientProvider,
} from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { API, APIProvider, apiOrigin } from './api.js';

export function Providers({
	children,
	initial,
}: {
	children: ReactNode;
	initial?: { apiOrigin: string; dehydratedState: DehydratedState };
}) {
	const [client] = useState(() => new QueryClient());
	const [api] = useState(
		() =>
			new API(
				initial?.apiOrigin ??
					apiOrigin(
						typeof window === 'undefined'
							? 'https://bowerybugle.nyc'
							: window.location.origin
					)
			)
	);
	return (
		<QueryClientProvider client={client}>
			<HydrationBoundary state={initial?.dehydratedState}>
				<APIProvider api={api}>{children}</APIProvider>
			</HydrationBoundary>
		</QueryClientProvider>
	);
}
