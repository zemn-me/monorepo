'use client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactNode } from 'react';
import z from 'zod';

import { ZEMN_ME_QUERY_CACHE_STORAGE_KEY } from '#root/project/me/zemn/constants/constants.js';
import { LocalStorageController } from '#root/project/me/zemn/hook/useLocalStorage.js';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			gcTime: 1000 * 60 * 60 * 24, // 24 hours
		},
	},
});

// Recommended: async persister with localStorage
const localStoragePersister = createAsyncStoragePersister({
	key: ZEMN_ME_QUERY_CACHE_STORAGE_KEY,
	storage: typeof window !== 'undefined' ? window.localStorage : undefined,
});

// Prevent CSP issues
z.config({ jitless: true });

export function Providers({ children }: ProviderProps) {
	return (
		<LocalStorageController>
			<PersistQueryClientProvider
				client={queryClient}
				persistOptions={{
					persister: localStoragePersister,
					maxAge: 1000 * 60 * 60 * 24 * 365,
					buster: 'v1',
				}}
			>
				{children}
			</PersistQueryClientProvider>
		</LocalStorageController>
	);
}
