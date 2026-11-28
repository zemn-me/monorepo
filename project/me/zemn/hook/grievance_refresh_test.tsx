import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const get = jest.fn<() => Promise<unknown>>();
const post = jest.fn<() => Promise<unknown>>();
jest.unstable_mockModule('openapi-fetch', () => ({
	default: () => ({ GET: get, POST: post }),
}));
const { useGetGrievances, usePostGrievances } = await import(
	'./useZemnMeApi.js'
);

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	value: true,
	configurable: true,
});

function Portal() {
	const list = useGetGrievances('test-token');
	const create = usePostGrievances('test-token');
	return (
		<>
			<button
				onClick={() =>
					create.mutate({
						headers: { Authorization: 'test-token' },
						body: { description: 'New grievance', priority: 1 },
					})
				}
			>
				Submit
			</button>
			<output>{list.data?.map(g => g.description).join(', ')}</output>
		</>
	);
}

it('shows a new grievance when the initial list request finishes after submission', async () => {
	const firstList = Promise.withResolvers<unknown>();
	const grievance = { description: 'New grievance', priority: 1 };
	get.mockReturnValueOnce(firstList.promise).mockResolvedValue({
		data: [grievance],
	});
	post.mockResolvedValue({ data: grievance, response: { ok: true } });
	const client = new QueryClient();
	const container = document.createElement('div');
	const root = createRoot(container);
	jest.useFakeTimers();
	try {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<Portal />
				</QueryClientProvider>
			)
		);
		expect(get).toHaveBeenCalledTimes(1);
		await act(async () => container.querySelector('button')!.click());
		expect(post).toHaveBeenCalledTimes(1);
		await act(async () => firstList.resolve({ data: [] }));
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1);
		});
		expect(container.querySelector('output')!.textContent).toBe(
			grievance.description
		);
	} finally {
		await act(async () => root.unmount());
		client.clear();
		jest.useRealTimers();
	}
});
