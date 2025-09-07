'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import z from 'zod';

import { LocalStorageController } from '#root/project/zemn.me/hook/useLocalStorage.js';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient();

// prevent CSP issues.
z.config({ jitless: true });

export function Providers({ children }: ProviderProps) {
	return (
		<LocalStorageController>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</LocalStorageController>
	);
}
