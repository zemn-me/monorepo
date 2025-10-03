'use client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import {
  QueryClient,
} from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client';
import { ReactNode } from 'react';
import z from 'zod';

import { LocalStorageController } from '#root/project/zemn.me/hook/useLocalStorage.js';

export interface ProviderProps {
  readonly children?: ReactNode;
}

// Configure the QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours, must be >= persist maxAge
    },
  },
});

// Create a persister backed by localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
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
          maxAge: 1000 * 60 * 60 * 24, // 24 hours
          buster: 'v1', // update this if you need to bust caches
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </LocalStorageController>
  );
}
