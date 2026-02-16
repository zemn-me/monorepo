'use client';

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

function isWindowCallbackMessage(value: unknown): value is WindowCallbackMessage { // codex wrote this and its bad but im not fixing rn
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
export function useWindowCallback(target: URL): Promise<string> {
	return new Promise((resolve, reject) => {
		const opened = window.open(target.toString(), '_blank');
		if (!opened) {
			reject(new UnableToOpenWindowError());
			return;
		}

		const origin = window.location.origin;

		function handler(event: MessageEvent) {
			if (event.origin !== origin) {
				return;
			}

			if (!isWindowCallbackMessage(event.data)) {
				return;
			}

			window.removeEventListener('message', handler);

			opened?.close();

			if (!event.data.href) {
				reject(new InvalidCallbackMessageError());
				return;
			}

			resolve(event.data.href);
		}

		window.addEventListener('message', handler);
	});
}
