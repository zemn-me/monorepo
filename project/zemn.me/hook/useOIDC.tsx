import { useLocalStorageItem } from "#root/project/zemn.me/hook/useLocalStorage.js";
import { AuthorizationCache } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer } from "#root/project/zemn.me/OAuth/clients.js";
import { and, firstItemIs } from "#root/ts/guard.js";
import { lensPromise } from "#root/ts/lens.js";
import { ID_Token, watchOutParseIdToken } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten as option_flatten, None, Some } from "#root/ts/option/types.js";
import { and_then, and_then as result_and_then, Err, flatten as result_flatten, Ok, result_collect, unwrap } from "#root/ts/result/result.js";
import { resultFromZod } from "#root/ts/zod/util.js";

function isUnexpiredIDToken(token: ID_Token): token is ID_Token {
	return token.exp > Math.floor(Date.now() / 1000);
}

export function allIdTokens(token: ID_Token): token is ID_Token {
	return true;
}

export function useOIDC<T extends ID_Token>(filter: (v: ID_Token) => v is T) {
	const f = firstItemIs(and(isUnexpiredIDToken, filter));
	const [authCache] = useLocalStorageItem(
		lensPromise(AuthorizationCache)
	);

	const aa =
		option_flatten(option_and_then(authCache, v => v === null ? None : Some(v)));

	const id_tokens = option_and_then(
		aa,
		v => result_flatten(result_and_then(
			v,
			q => result_collect(Object.values(q).map(
				v => {
					const r = resultFromZod(watchOutParseIdToken.safeParse(v.id_token));
					return result_and_then(
						r,
						vv => [vv, v.id_token] as const
					)
				}
			)))
		)
	);


	const filtered_tokens = option_and_then(
		id_tokens,
		ts => result_and_then(
			ts,
			v => v.filter(f).map(([, v]) => v)
		)
	)

	return filtered_tokens
}

/**
 * Open a new tab for the user to do OIDC. The {@link useOIDC} hook
 * will automatically update to a defined value when the user completes
 * authentication.
 *
 * @param issuer
 */
export function requestOIDC(issuer?: Issuer) {
	const wndOrNull = window.open(`/auth?${new URLSearchParams([
		...issuer != undefined ? [
			["hint", issuer]
		] : []
	])}`, '_blank');

	const wnd = wndOrNull === null ?
		Err(new Error("window open blocked")) : Ok(wndOrNull);



	and_then(wnd, w => w.focus());

	return unwrap(wnd);
}
