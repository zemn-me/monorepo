'use client';

import { useWindowCallback } from '#root/project/zemn.me/hook/useWindowCallback.js';

export {
	InvalidCallbackMessageError,
	UnableToOpenWindowError,
} from '#root/project/zemn.me/hook/useWindowCallback.js';

export function useAuthRedirect() {
	return useWindowCallback();
}
