import { afterEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { resolve } from '#root/ts/future/future.js';

const fetchJournal = jest.fn<() => Promise<unknown>>();
jest.unstable_mockModule('openapi-fetch', () => ({
	default: () => ({ GET: fetchJournal }),
}));
jest.unstable_mockModule('#root/ts/oidc/oidc.js', () => ({
	watchOutParseIdToken: {
		safeParse: () => ({
			success: true,
			data: { jti: 'journal-refresh-test' },
		}),
	},
}));
const { useGetJournal } = await import('./useZemnMeApi.js');

function JournalSummary() {
	return useGetJournal(resolve('test-token'))(
		journal => (
			<output>
				{journal.summaries.map(summary => summary.title).join(', ')}
			</output>
		),
		() => <output>Loading</output>,
		() => <output>Error</output>
	);
}

afterEach(() => {
	jest.useRealTimers();
	fetchJournal.mockReset();
});

it('refreshes an aggregate that finishes after the final entry is ready', async () => {
	jest.useFakeTimers();
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const container = document.createElement('div');
	const root = createRoot(container);
	fetchJournal.mockResolvedValue({
		data: {
			entries: [{ status: 'ready' }],
			summaries: [{ title: 'Earlier overview' }],
		},
	});
	try {
		await act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<JournalSummary />
				</QueryClientProvider>
			);
		});
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1);
		});
		expect(container.textContent).toBe('Earlier overview');

		fetchJournal.mockResolvedValue({
			data: {
				entries: [{ status: 'ready' }],
				summaries: [{ title: 'Overview including the last upload' }],
			},
		});
		await act(async () => {
			await jest.advanceTimersByTimeAsync(10001);
		});
		expect(container.textContent).toBe(
			'Overview including the last upload'
		);
	} finally {
		await act(async () => root.unmount());
		client.clear();
	}
});
