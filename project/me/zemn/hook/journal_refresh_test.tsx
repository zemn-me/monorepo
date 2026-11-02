import { afterEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { resolve } from '#root/ts/future/future.js';

const fetchJournal = jest.fn<
	(path: string, options?: { signal?: AbortSignal }) => Promise<unknown>
>();
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
const { useGetJournal, useGetJournalUploads } = await import('./useZemnMeApi.js');

function JournalSummary({ enabled = true }: { readonly enabled?: boolean }) {
	return useGetJournal(resolve('test-token'), enabled)(
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

it('does not fetch or poll the full journal while its observer is disabled', async () => {
	jest.useFakeTimers();
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(['get', '/journal', 'journal-refresh-test'], {
		entries: [{ status: 'ready' }],
		summaries: [{ title: 'Previously loaded journal' }],
	});
	const root = createRoot(document.createElement('div'));
	try {
		await act(async () => {
			root.render(
				<QueryClientProvider client={client}>
					<JournalSummary enabled={false} />
				</QueryClientProvider>
			);
		});
		await act(async () => {
			await jest.advanceTimersByTimeAsync(30001);
		});
		expect(fetchJournal).not.toHaveBeenCalled();
	} finally {
		await act(async () => root.unmount());
		client.clear();
	}
});

function UploadSummary() {
	return useGetJournalUploads(resolve('test-token'), true)(
		value => <output>{value.entries.length}</output>,
		() => <output>Loading</output>,
		() => <output>Error</output>
	);
}

it.each([JournalSummary, UploadSummary])(
	'aborts an obsolete journal request when its query is cancelled (%p)',
	async Summary => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		let signal: AbortSignal | undefined;
		fetchJournal.mockImplementation(async (_path, options) => {
			signal = options?.signal;
			return new Promise(() => {
				// Keep the HTTP request pending until React Query cancels it.
			});
		});
		const root = createRoot(document.createElement('div'));
		try {
			await act(async () => {
				root.render(
					<QueryClientProvider client={client}>
						<Summary />
					</QueryClientProvider>
				);
			});
			expect(fetchJournal).toHaveBeenCalledTimes(1);
			await act(async () => {
				await client.cancelQueries({ queryKey: ['get', '/journal'] });
			});
			expect(signal).toBeDefined();
			expect(signal?.aborted).toBe(true);
		} finally {
			await act(async () => root.unmount());
			client.clear();
		}
	}
);
