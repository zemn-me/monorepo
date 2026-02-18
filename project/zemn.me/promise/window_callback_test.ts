import { describe, expect, it, jest } from '@jest/globals';

import { useWindowCallback } from '#root/project/zemn.me/promise/window_callback.js';

describe('useWindowCallback', () => {
	it('focuses the opener window after receiving callback message', async () => {
		const removeEventListener = jest.fn<(event: string, cb: EventListenerOrEventListenerObject) => void>();
		const addEventListener = jest.fn<(event: string, cb: EventListenerOrEventListenerObject) => void>();
		const focus = jest.fn();
		const close = jest.fn();

		let messageHandler: ((event: MessageEvent) => void) | undefined;

		addEventListener.mockImplementation((event, cb) => {
			if (event === 'message') {
				messageHandler = cb as (event: MessageEvent) => void;
			}
		});

		const mockedWindow = {
			location: {
				origin: 'https://example.test',
			},
			open: jest.fn(() => ({ close })),
			addEventListener,
			removeEventListener,
			focus,
		};

		(globalThis as { window: unknown }).window = mockedWindow as unknown;

		const callbackPromise = useWindowCallback(new URL('https://issuer.example/auth'));

		expect(messageHandler).toBeDefined();
		messageHandler?.({
			origin: 'https://example.test',
			data: {
				type: 'window-callback',
				href: 'https://example.test/callback#id_token=abc',
			},
		} as MessageEvent);

		await expect(callbackPromise).resolves.toBe('https://example.test/callback#id_token=abc');
		expect(close).toHaveBeenCalledTimes(1);
		expect(focus).toHaveBeenCalledTimes(1);
		expect(removeEventListener).toHaveBeenCalledTimes(1);
	});
});
