'use client';

import { useWindowCallback, UnableToOpenWindowError, InvalidCallbackMessageError } from '#root/project/zemn.me/hook/useWindowCallback.js';

export { UnableToOpenWindowError, InvalidCallbackMessageError } from '#root/project/zemn.me/hook/useWindowCallback.js';

export function useAuthRedirect() {
	return useWindowCallback();
}
