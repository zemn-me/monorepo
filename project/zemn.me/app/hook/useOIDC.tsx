import { useState } from "react";

import { useLocalStorageItem } from "#root/project/zemn.me/app/hook/useLocalStorage.js";
import { AuthorizationCache } from "#root/project/zemn.me/app/localStorage/localStorage.js";
import { Issuer, OAuthClientByIssuer } from "#root/project/zemn.me/app/OAuth/clients.js";
import { lensPromise } from "#root/ts/lens.js";
import { verifyOIDCToken } from "#root/ts/oidc/oidc.js";
import { and_then, flatten as option_flatten, None, ok_or_else, Some } from "#root/ts/option/types.js";
import { and_then as result_and_then, Err, flatten as result_flatten, Ok, result_promise_transpose } from "#root/ts/result_types.js";

class MissingToken extends Error {

}

class Loading extends Error {

}

export function useOIDC(issuer: Issuer ) {
	const audience = OAuthClientByIssuer(issuer).clientId;
	const [authCache] = useLocalStorageItem(
		lensPromise(AuthorizationCache)
	);
	const [result, setResult] = useState();

	const aa =
		option_flatten(and_then(authCache, v => v === null ? None : Some(v)));

	const bb = result_flatten(ok_or_else(
		aa,
		() => new Loading("loading...")
	));

	const candidate = result_flatten(result_and_then(
		bb,
		v => {
			const cand = v[issuer];
			if (cand === undefined) return Err(new MissingToken("missing token"));

			return Ok(cand);
		}
	));

	const verifiedToken = result_promise_transpose(result_and_then(
		candidate,
		v => verifyOIDCToken(
			v.id_token,
			issuer,
			audience,
			0
		)
	)).then(r => result_flatten(r))

	return verifiedToken
}

/**
 * Open a new tab for the user to do OIDC. The {@link useOIDC} hook
 * will automatically update to a defined value when the user completes
 * authentication.
 *
 * @param issuer
 */
export function requestOIDC(issuer?: Issuer) {
	const wnd = window.open(`/auth?${new URLSearchParams([
		...issuer != undefined ? [
			["hint", issuer]
		] : []
	])}`, '_blank');

	wnd?.focus();

	return wnd;
}
