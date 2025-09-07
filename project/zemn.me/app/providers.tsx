'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import z from 'zod';

import { LocalStorageController } from '#root/project/zemn.me/hook/useLocalStorage.js';

export interface ProviderProps {
	readonly children?: ReactNode;
}

const queryClient = new QueryClient();

export function Providers({ children }: ProviderProps) {
	useEffect(() => { z.config({ jitless: true }); return undefined }, [])
	return (
		<LocalStorageController>
			<QueryClientProvider client={queryClient}>
				{children}
			</QueryClientProvider>
		</LocalStorageController>
	);
}
