'use client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { ReactNode, useState } from 'react';
import z from 'zod';

import { ZEMN_ME_QUERY_CACHE_STORAGE_KEY } from '#root/project/me/zemn/constants/constants.js';
import { LocalStorageController } from '#root/project/me/zemn/hook/useLocalStorage.js';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				gcTime:
					typeof window === 'undefined'
						? Infinity
						: 1000 * 60 * 60 * 24,
			},
		},
	});

// Recommended: async persister with localStorage
const localStoragePersister = createAsyncStoragePersister({
	key: ZEMN_ME_QUERY_CACHE_STORAGE_KEY,
	storage: typeof window !== 'undefined' ? window.localStorage : undefined,
	// A completed login must survive an immediate full-document OAuth redirect.
	throttleTime: 0,
});

// Prevent CSP issues
z.config({ jitless: true });

export function Providers({ children }: ProviderProps) {
	// A warm SSR process serves multiple people; never share its query cache.
	const [queryClient] = useState(createQueryClient);
	return (
		<NuqsAdapter>
			<LocalStorageController>
				<PersistQueryClientProvider
					client={queryClient}
					persistOptions={{
						persister: localStoragePersister,
						maxAge: 1000 * 60 * 60 * 24 * 365,
						buster: 'v1',
						dehydrateOptions: {
							shouldDehydrateQuery: query =>
								query.state.status === 'success' &&
								query.meta?.['persist'] !== false,
						},
					}}
				>
					{children}
				</PersistQueryClientProvider>
			</LocalStorageController>
		</NuqsAdapter>
	);
}
