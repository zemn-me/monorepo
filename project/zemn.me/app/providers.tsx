'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { LocalStorageController } from '#root/project/zemn.me/hook/useLocalStorage.js';
import { ApiBaseProvider } from '#root/project/zemn.me/hook/useZemnMeApi.js';

export interface ProviderProps {
        readonly children?: ReactNode;
        readonly apiBaseUrl?: string;
}

const queryClient = new QueryClient();

export function Providers({ children, apiBaseUrl }: ProviderProps) {
        return (
                <LocalStorageController>
                        <QueryClientProvider client={queryClient}>
                                <ApiBaseProvider baseUrl={apiBaseUrl}>
                                        {children}
                                </ApiBaseProvider>
                        </QueryClientProvider>
                </LocalStorageController>
        );
}
