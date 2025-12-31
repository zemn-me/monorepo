import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';
import * as option from '#root/ts/option/types.js';

export function useIsLoggedIn(): boolean {
	const [token] = useOIDC();
	return option.is_some(token);
}
