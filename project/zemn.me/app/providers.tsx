'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { LocalStorageController } from '#root/project/zemn.me/app/hook/useLocalStorage.js';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient();

export function Providers({ children }: ProviderProps) {
	return (
		<LocalStorageController>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</LocalStorageController>
	);
}
