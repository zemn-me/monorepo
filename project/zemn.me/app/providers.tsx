'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ReactNode } from 'react';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient();

export function Providers({ children }: ProviderProps) {
	return (
		<NuqsAdapter>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</NuqsAdapter>
	);
}
