'use client';

import { useWindowCallback } from '#root/project/me/zemn/promise/window_callback.js';

export {
	InvalidCallbackMessageError,
	UnableToOpenWindowError,
} from '#root/project/me/zemn/promise/window_callback.js';

export function useAuthRedirect() {
	return useWindowCallback;
}
