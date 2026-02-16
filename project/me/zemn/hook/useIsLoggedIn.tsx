import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import * as option from '#root/ts/option/types.js';

export function useIsLoggedIn(): boolean {
	const [token] = useZemnMeAuth();
	return option.is_some(token);
}
