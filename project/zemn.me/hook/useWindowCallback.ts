'use client';

import { useCallback, useState } from 'react';

import { None, Option, Some } from '#root/ts/option/types.js';
import { Err, Ok, Result } from '#root/ts/result/result.js';

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
export function useWindowCallback() {
	// idk why but it's evaling None()
	const [value, setValue] = useState<Option<Result<string, Error>>>(() => None);

	const openWindow = useCallback(async (target: URL) => {
		const opened = window.open(target.toString(), '_blank');
		if (!opened) {
			throw new UnableToOpenWindowError();
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
				return setValue(
					() => Some(Err(new InvalidCallbackMessageError())));
			}

			return setValue( () => Some(Ok(event.data.href)));
		}



			window.addEventListener('message', handler);

	}, [setValue]);

	return [value, openWindow] as const;
}
