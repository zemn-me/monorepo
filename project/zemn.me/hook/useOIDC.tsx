import { Controller, mustUseLocalStorageController, useLocalStorageController, useLocalStorageItem } from "#root/project/zemn.me/hook/useLocalStorage.js";
import { AuthorizationCache, clientSecret } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer, OAuthClientByIssuer } from "#root/project/zemn.me/OAuth/clients.js";
import { and, firstItemIs } from "#root/ts/guard.js";
import { lensPromise } from "#root/ts/lens.js";
import { ID_Token, oidcAuthorizeUri, watchOutParseIdToken } from "#root/ts/oidc/oidc.js";
import b64 from 'base64-js';
import { and_then as option_and_then, flatten as option_flatten, None, Some, and_then_flatten, option_promise_transpose, Option, option_result_and_then } from "#root/ts/option/types.js";
import { and_then as result_and_then, flatten as result_flatten, result_collect, Result, Ok, Err, result_promise_transpose, result_and } from "#root/ts/result/result.js";
import { resultFromZod } from "#root/ts/zod/util.js";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

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
		and_then_flatten(authCache, v => v === null ? None : Some(v));

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


const challengeForIssuerPrefix = "0|";

const challengeStringHashInputForIssuer =
	(issuer: string) => challengeForIssuerPrefix + issuer;

/**
 * Generates an entropy challenge for a given issuer.
 *
 * I dont really care too much for n-onces. These can
 * be used as state tokens without worrying too much
 * about disclosure.
 *
 * It's possible the state tokens could build up in logs
 * and stuff but overall i dont care rn.
 */
async function challengeForIssuer(masterKey: CryptoKey, issuer: string) {
	return crypto.subtle.sign("HMAC", masterKey, new TextEncoder().encode(challengeStringHashInputForIssuer(issuer)));
}

async function challengeStringForIssuer(masterKey: CryptoKey, issuer: string) {
	return b64.fromByteArray(new Uint8Array(await challengeForIssuer(masterKey, issuer)))
}

async function verifyChallengeForIssuer(masterKey: CryptoKey, issuer: string, signature: ArrayBuffer) {	return crypto.subtle.verify(
		"HMAC",
		masterKey,
		signature,
		new TextEncoder().encode(challengeStringHashInputForIssuer(issuer))
	)
}

function queryToResult<T, E>(
	r: UseQueryResult<T, E>
): Option<Result<T, E>> {
	switch (r.status) {
		case "error":
			return Some(Err(r.error))
		case "pending":
			return None;
		case "success":
			return Some(Ok(r.data))

	}
}

/**
 * Get an OIDC challenge for the given issuer.
 */
function oidcChallenge(
	issuer: string,
	storage: Controller,
){
	return clientSecret(storage)
		.then(secret => challengeStringForIssuer(secret, issuer))

}

/**
 * Open a new tab for the user to do OIDC. The {@link useOIDC} hook
 * will automatically update to a defined value when the user completes
 * authentication.
 *
 * @param issuer
 */
export function useRequestOIDC(issuer: Issuer) {
	const storage = mustUseLocalStorageController();

	const urlMess = queryToResult(useQuery({
		queryKey: [issuer, storage],
		queryFn: () => result_promise_transpose(result_and_then(
			storage,
			async storage => {
				const challenge = oidcChallenge(
					issuer, storage
				);

				const uri = oidcAuthorizeUri(
					await challenge, await challenge,
					new URL("https://zemn.me/auth"),
					OAuthClientByIssuer(issuer).clientId,
					new URL(issuer)
				)

				return uri;
			}
		))
	}));

	const url = option_and_then(
		urlMess,
		r => result_flatten(result_flatten(r))
	)

	return option_result_and_then(
		url,
		v => () => {
			const w = window.open(v)
			w?.focus()
			return w
		}
	)
}
