import { useLocalStorageItem } from "#root/project/zemn.me/app/hook/useLocalStorage.js";
import { AuthorizationCache } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer } from "#root/project/zemn.me/OAuth/clients.js";
import { lensPromise } from "#root/ts/lens.js";
import { and_then, flatten, None, option_result_transpose, Some } from "#root/ts/option/types.js";
import { and_then as result_and_then } from "#root/ts/result_types.js";

export function useOIDC(issuer: Issuer) {
	const [authCache] = useLocalStorageItem(
		lensPromise(AuthorizationCache)
	);

	const aa =
		flatten(and_then(authCache, v => v === null ? None : Some(v)));

	const maybeOurToken =
		result_and_then(
			option_result_transpose(
				and_then(
					aa,
					result => result_and_then(
						result,
						v => v[issuer] === undefined ? None : Some(v[issuer])
					)
				)),
			r => flatten(r)
		);

	// TODO: check expiry here...


	return maybeOurToken
}

/**
 * Open a new tab for the user to do OIDC. The {@link useOIDC} hook
 * will automatically update to a defined value when the user completes
 * authentication.
 *
 * @param issuer
 */
export function requestOIDC(issuer?: Issuer) {
	window.open(`/auth?${new URLSearchParams([
		...issuer != undefined?[
			["hint", issuer]
		]: []
	])}`, '_blank')?.focus();
}
