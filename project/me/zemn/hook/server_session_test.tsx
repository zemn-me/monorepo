import { expect, it, jest } from '@jest/globals';
import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
	QueryClientProvider,
} from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { loading, resolve } from '#root/ts/future/future.js';
import {
	type ServerSession,
	ServerSessionProvider,
	useServerSession,
} from './server_session.js';
import { useGetJournal } from './useZemnMeApi.js';

const session: ServerSession = {
	claims: {
		iss: 'https://api.zemn.me',
		sub: 'alice',
		aud: 'zemn.me',
		iat: 1,
		exp: Math.floor(Date.now() / 1000) + 3600,
		jti: 'alice-session',
	},
	scopes: ['journal_read'],
};
const journal = {
	entries: [],
	summaries: [{ title: 'Alice private journal' }],
};
function View({ token }: { readonly token?: string }) {
	const { clear } = useServerSession();
	return (
		<>
			<button onClick={clear}>Log out</button>
			{useGetJournal(token ? resolve(token) : loading(undefined))(
				value => (
					<p>
						{value.summaries
							.map(summary => summary.title)
							.join(', ')}
					</p>
				),
				() => (
					<p>Login required</p>
				),
				() => (
					<p>Error</p>
				)
			)}
		</>
	);
}

it('renders the hydrated account without exposing a token and forgets it on logout', async () => {
	const queryClient = new QueryClient();
	queryClient.setQueryData(['get', '/journal', session.claims.jti], journal);
	const tree = (
		<QueryClientProvider client={queryClient}>
			<ServerSessionProvider session={session}>
				<HydrationBoundary state={dehydrate(queryClient)}>
					<View />
				</HydrationBoundary>
			</ServerSessionProvider>
		</QueryClientProvider>
	);
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () => {
			root.render(tree);
		});
		expect(container.textContent).toContain('Alice private journal');
		await act(async () => {
			container.querySelector('button')?.click();
		});
		expect(container.textContent).not.toContain('Alice private journal');
		expect(container.textContent).toContain('Login required');
		// Reusing stale loader data must not resurrect the identity.
		await act(async () => {
			root.render(tree);
		});
		expect(container.textContent).not.toContain('Alice private journal');
	} finally {
		await act(async () => root.unmount());
		queryClient.clear();
	}
});

function SessionName() {
	const { session } = useServerSession();
	return <output>{session?.claims.sub ?? 'Signed out'}</output>;
}

it('expires server metadata without overflowing browser timers for month-long API tokens', async () => {
	jest.useFakeTimers();
	const month = 30 * 24 * 60 * 60 * 1000;
	const current = {
		...session,
		claims: { ...session.claims, exp: (Date.now() + month) / 1000 },
	};
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () => {
			root.render(
				<ServerSessionProvider session={current}>
					<SessionName />
				</ServerSessionProvider>
			);
		});
		await act(async () => {
			await jest.advanceTimersByTimeAsync(2 ** 31);
		});
		expect(container.textContent).toBe('alice');
		await act(async () => {
			await jest.advanceTimersByTimeAsync(month - 2 ** 31);
		});
		expect(container.textContent).toBe('Signed out');
	} finally {
		await act(async () => root.unmount());
		jest.useRealTimers();
	}
});
