'use client';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

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
