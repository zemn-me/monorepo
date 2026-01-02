'use client';

import { useWindowCallback } from '#root/project/zemn.me/promise/window_callback.js';

export {
	InvalidCallbackMessageError,
	UnableToOpenWindowError,
} from '#root/project/zemn.me/promise/window_callback.js';

export function useAuthRedirect() {
	return useWindowCallback;
}
