import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
	AuthSessionProvider,
	OIDC_ID_TOKEN_HINT_STORAGE_KEY,
	useAuthSession,
} from './useAuthSession.js';

function Harness() {
	const { endSession, generation } = useAuthSession();
	return (
		<>
			<output aria-label="Session generation">{generation}</output>
			<button onClick={() => endSession('latest-id-token')} type="button">
				Log out
			</button>
			<button onClick={() => endSession(null)} type="button">
				Switch user
			</button>
		</>
	);
}

let clearPersistedClient: jest.Mock<() => Promise<void>>;
let container: HTMLDivElement;
let queryClient: QueryClient;
let root: Root;

beforeEach(() => {
	localStorage.clear();
	clearPersistedClient = jest.fn(async () => undefined);
	queryClient = new QueryClient();
	queryClient.setQueryData(['authenticated'], 'private data');
	container = document.createElement('div');
	root = createRoot(container);
	document.body.appendChild(container);
	act(() => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<AuthSessionProvider
					clearPersistedClient={clearPersistedClient}
				>
					<Harness />
				</AuthSessionProvider>
			</QueryClientProvider>
		);
	});
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

it('clears cached application state while retaining only the login hint', () => {
	act(() => {
		Array.from(container.querySelectorAll('button'))
			.find(button => button.textContent === 'Log out')
			?.click();
	});

	expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	expect(localStorage.getItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY)).toBe(
		'latest-id-token'
	);
	expect(clearPersistedClient).toHaveBeenCalledTimes(1);
	expect(
		container.querySelector('[aria-label="Session generation"]')
			?.textContent
	).toBe('1');
});

it('clears the token hint before switching users', () => {
	localStorage.setItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY, 'previous-id-token');

	act(() => {
		Array.from(container.querySelectorAll('button'))
			.find(button => button.textContent === 'Switch user')
			?.click();
	});

	expect(localStorage.getItem(OIDC_ID_TOKEN_HINT_STORAGE_KEY)).toBeNull();
	expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	expect(clearPersistedClient).toHaveBeenCalledTimes(1);
});
