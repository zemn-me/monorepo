import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { API, APIProvider, apiOrigin } from './api.js';

export function Providers({ children }: { children: ReactNode }) {
	const [client] = useState(() => new QueryClient());
	const [api] = useState(
		() =>
			new API(
				apiOrigin(
					typeof window === 'undefined'
						? 'https://bowerybugle.nyc'
						: window.location.origin
				)
			)
	);
	return (
		<QueryClientProvider client={client}>
			<APIProvider api={api}>{children}</APIProvider>
		</QueryClientProvider>
	);
}
