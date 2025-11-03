'use client';

import { useCallback } from 'react';

export class UnableToOpenWindowError extends Error {
	constructor() {
		super('unable to open window');
	}
}

export class InvalidCallbackMessageError extends Error {
	constructor(message = 'invalid window callback message') {
		super(message);
	}
}

type WindowCallbackMessage = {
	type: 'window-callback';
	href: string;
};

function isWindowCallbackMessage(value: unknown): value is WindowCallbackMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Partial<WindowCallbackMessage>).type === 'window-callback' &&
		typeof (value as Partial<WindowCallbackMessage>).href === 'string'
	);
}

/**
 * Opens a window to the `target` URL and resolves with the final `href` once the
 * popup navigates back to our callback endpoint and posts a message.
 */
export function useWindowCallback() {
	return useCallback(async (target: URL): Promise<string> => {
		const opened = window.open(target.toString(), '_blank');
		if (!opened) {
			throw new UnableToOpenWindowError();
		}

		return await new Promise<string>((resolve, reject) => {
			const origin = window.location.origin;
			let watchdog: number | undefined;

			function cleanup() {
				window.removeEventListener('message', handler);
				if (watchdog !== undefined) {
					window.clearInterval(watchdog);
					watchdog = undefined;
				}
			}

			function handler(event: MessageEvent) {
				if (event.origin !== origin) {
					return;
				}

				if (!isWindowCallbackMessage(event.data)) {
					return;
				}

				cleanup();

					try {
						opened.close();
					} catch {
						// best effort; ignore failures closing popup
					}

				if (!event.data.href) {
					reject(new InvalidCallbackMessageError());
					return;
				}

				resolve(event.data.href);
			}

			window.addEventListener('message', handler);

			watchdog = window.setInterval(() => {
				if (opened.closed) {
					cleanup();
					reject(new InvalidCallbackMessageError('window closed before callback was received'));
				}
			}, 500);
		});
	}, []);
}
