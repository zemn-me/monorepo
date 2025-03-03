import { AuthorizationCache } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer } from "#root/project/zemn.me/OAuth/clients.js";
import { and_then, None, Some } from "#root/ts/option/types.js";

export function useOIDC(issuer: Issuer) {
	const [authCache] = AuthorizationCache();

	const maybeOurToken = and_then(
		authCache,
		v => v[issuer] === undefined? None: Some(v[issuer])
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
