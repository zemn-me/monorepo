'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient();

export function Providers({ children }: ProviderProps) {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	);
}
