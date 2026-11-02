import { afterEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { resolve } from '#root/ts/future/future.js';

const getStatus = jest.fn<() => Promise<unknown>>();
const postStatus = jest.fn<() => Promise<unknown>>();
jest.unstable_mockModule('openapi-fetch', () => ({
	default: () => ({ GET: getStatus, POST: postStatus }),
}));
jest.unstable_mockModule('#root/ts/oidc/oidc.js', () => ({
	watchOutParseIdToken: {
		safeParse: () => ({
			success: true,
			data: { jti: 'key-mutation-test' },
		}),
	},
}));
const { useGetMeKeyStatus, usePostMeKey } = await import('./useZemnMeApi.js');

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	value: true,
	configurable: true,
});
function KeyControl() {
	const token = resolve('test-token');
	const status = useGetMeKeyStatus(token);
	const mutation = usePostMeKey(token);
	return (
		<button
			disabled={mutation.isPending}
			onClick={() =>
				mutation.mutate(
					status(
						value => !value.open,
						() => true,
						() => true
					)
				)
			}
		>
			{status(
				value => (value.open ? 'Open' : 'Closed'),
				() => 'Loading',
				() => 'Error'
			)}
		</button>
	);
}
const status = (open: boolean) => ({ data: { open } });
afterEach(() => {
	getStatus.mockReset();
	postStatus.mockReset();
});

async function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const container = document.createElement('div');
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<KeyControl />
			</QueryClientProvider>
		)
	);
	await act(async () => {
		await new Promise(resolve => setTimeout(resolve, 0));
	});
	return { client, container, root };
}

it('keeps the door control disabled until the server confirms the new state', async () => {
	const confirmed = Promise.withResolvers<unknown>();
	getStatus
		.mockResolvedValueOnce(status(true))
		.mockReturnValue(confirmed.promise);
	postStatus.mockResolvedValue({ data: {}, response: { ok: true } });
	const { client, container, root } = await mount();
	try {
		const button = container.querySelector('button')!;
		expect(button.textContent).toBe('Open');
		await act(async () => button.click());
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(getStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
		expect(button.disabled).toBe(true);
		await act(async () => confirmed.resolve(status(false)));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(button.textContent).toBe('Closed');
		expect(button.disabled).toBe(false);
	} finally {
		await act(async () => root.unmount());
		client.clear();
	}
});

it('does not let a stale poll overwrite the optimistic relock', async () => {
	const oldPoll = Promise.withResolvers<unknown>();
	const posted = Promise.withResolvers<unknown>();
	getStatus
		.mockResolvedValueOnce(status(true))
		.mockReturnValueOnce(oldPoll.promise)
		.mockResolvedValue(status(false));
	postStatus.mockReturnValue(posted.promise);
	const { client, container, root } = await mount();
	try {
		const button = container.querySelector('button')!;
		void client.invalidateQueries({ queryKey: ['get', '/callbox'] });
		await act(async () => button.click());
		await act(async () => oldPoll.resolve(status(true)));
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(button.textContent).toBe('Closed');
		expect(button.disabled).toBe(true);
		await act(async () =>
			posted.resolve({ data: {}, response: { ok: true } })
		);
	} finally {
		await act(async () => root.unmount());
		client.clear();
	}
});
