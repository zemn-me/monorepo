import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocalStorageController, useLocalStorageItem } from "#root/project/zemn.me/hook/useLocalStorage.js";
import { AuthorizationCache, clientSecret } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer, OAuthClientByIssuer } from "#root/project/zemn.me/OAuth/clients.js";
import { lensPromise } from "#root/ts/lens.js";
import { ID_Token, oidcAuthorizeUri, watchOutParseIdToken } from "#root/ts/oidc/oidc.js";
import { stateStringForRequest } from "#root/ts/oidc/state.js";
import { and_then as option_and_then, flatten as option_flatten, None, Some, result_to_option, unwrap_or as option_unwrap_or } from "#root/ts/option/types.js";
import { Err, Ok, and_then as result_and_then, flatten as result_flatten, result_collect, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result/result.js";
import { resultFromZod } from "#root/ts/zod/util.js";
import { useWindowCallback, InvalidCallbackMessageError } from "#root/project/zemn.me/hook/useWindowCallback.js";

declare global {
	interface Window {
		__oidcRequestURL?: string | null;
		__oidcUseTestIssuer?: boolean;
		__oidcEffectiveIssuer?: string;
	}
}

function isUnexpiredIDToken(token: ID_Token): token is ID_Token {
	return token.exp > Math.floor(Date.now() / 1000);
}

export function useOIDC(issuer: Issuer): [string | null, string, () => Promise<void>, boolean] {
	const [authCache] = useLocalStorageItem(lensPromise(AuthorizationCache));
	const controller = useLocalStorageController();
	const [requestURL, setRequestURL] = useState("");
	const [effectiveIssuer, setEffectiveIssuer] = useState<string>(issuer);
	const testIssuer = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER ?? "http://localhost:43111";
	const openWindowCallback = useWindowCallback();
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [pendingState, setPendingState] = useState<string | null>(null);
	const [localToken, setLocalToken] = useState<string | null>(null);

	useEffect(() => {
		setLocalToken(null);
	}, [effectiveIssuer]);

const storeTokenInCache = useCallback((token: string) => {
	if (typeof window === "undefined") {
		return;
	}

	const cacheKey = "1";
	let cache: Record<string, { id_token: string }> = {};

	try {
		const raw = window.localStorage.getItem(cacheKey);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === "object") {
				cache = parsed as Record<string, { id_token: string }>;
			}
		}
	} catch (error) {
		console.warn("Failed to read existing authorization cache", error);
	}

	cache[effectiveIssuer] = { id_token: token };

	try {
		const serialized = JSON.stringify(cache);
		window.localStorage.setItem(cacheKey, serialized);
		try {
			const event = new StorageEvent("storage", { key: cacheKey, newValue: serialized, storageArea: window.localStorage });
			window.dispatchEvent(event);
		} catch (dispatchError) {
			// StorageEvent may not be constructible in all environments; ignore if so.
		}
	} catch (error) {
		console.error("Failed to store id_token", error);
	}
	setLocalToken(token);
}, [effectiveIssuer]);

const beginLogin = useCallback(async () => {
	if (!requestURL) {
		return;
	}

	setIsAuthenticating(true);

	try {
		const target = new URL(requestURL);
		const href = await openWindowCallback(target);
		const callbackUrl = new URL(href, window.location.origin);

		if (callbackUrl.origin !== window.location.origin) {
			throw new InvalidCallbackMessageError("unexpected callback origin");
		}

		const fragment = callbackUrl.hash.startsWith("#") ? callbackUrl.hash.slice(1) : callbackUrl.hash;
		const params = new URLSearchParams(fragment);
		const idToken = params.get("id_token");
		if (!idToken) {
			throw new InvalidCallbackMessageError("callback missing id_token");
		}

		const returnedState = params.get("state");
		if (pendingState && returnedState && pendingState !== returnedState) {
			console.warn("OIDC state mismatch", { expected: pendingState, returned: returnedState });
		}

		storeTokenInCache(idToken);
		setPendingState(null);
	} catch (error) {
		console.error("OIDC login failed", error);
	} finally {
		setIsAuthenticating(false);
	}
}, [openWindowCallback, pendingState, requestURL, storeTokenInCache]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const host = window.location.hostname;
		if (host === "localhost" || host === "127.0.0.1") {
			setEffectiveIssuer(testIssuer);
		} else {
			setEffectiveIssuer(issuer);
		}
	}, [issuer, testIssuer]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.__oidcRequestURL = requestURL === "" ? null : requestURL;
		}
	}, [requestURL]);

	const useTestIssuer = effectiveIssuer !== issuer;
	const client = OAuthClientByIssuer(effectiveIssuer);

	useEffect(() => {
		let cancelled = false;

		async function computeRequestURL() {
			if (typeof window === "undefined") {
				return;
			}

			const callback = new URL(window.location.origin);
			callback.pathname = "/callback";
			callback.search = "";
			callback.hash = "";
			window.__oidcUseTestIssuer = useTestIssuer;
			window.__oidcEffectiveIssuer = effectiveIssuer;

		try {
			if (useTestIssuer) {
				let nonce: string;
				if (typeof window.crypto?.getRandomValues === "function") {
					const random = new Uint8Array(16);
					window.crypto.getRandomValues(random);
					nonce = Array.from(random, b => b.toString(16).padStart(2, "0")).join("");
				} else {
					nonce = Math.random().toString(36).slice(2);
				}
				const authUrl = new URL("/authorize", effectiveIssuer);
				authUrl.search = new URLSearchParams({
					response_type: "id_token",
					client_id: client.clientId,
					redirect_uri: callback.toString(),
					scope: "openid",
					nonce,
					state: nonce,
				}).toString();
				setPendingState(nonce);
				setRequestURL(authUrl.toString());
				return;
			}

				const ctrl = option_unwrap_or(controller, null);
				if (ctrl === null) {
					setRequestURL("");
					window.__oidcRequestURL = null;
					setPendingState(null);
					return;
				}

				const masterKey = await clientSecret(ctrl);
				const state = await stateStringForRequest(await masterKey, {
					issuer: effectiveIssuer,
					clientId: client.clientId,
					redirectUri: callback.toString(),
				});

				setPendingState(state);

				const authUrlResult = await oidcAuthorizeUri(
					state,
					state,
					callback,
					client.clientId,
					new URL(effectiveIssuer)
				);

				const authUrl = result_unwrap_or_else(authUrlResult, err => {
					console.error("Failed to build OIDC authorization URL", err);
					return callback;
				});

				if (!cancelled) {
					setRequestURL(authUrl.toString());
				}
			} catch (err) {
				console.error("Failed to prepare OIDC request", err);
				if (!cancelled) {
					setRequestURL("");
					setPendingState(null);
				}
			}
		}

		void computeRequestURL();

		return () => {
			cancelled = true;
		};
	}, [controller, effectiveIssuer, useTestIssuer, client.clientId, issuer]);

	const token = useMemo(() => {
		const cacheOption = option_flatten(option_and_then(authCache, v => v === null ? None : Some(v)));

	const idTokens = option_and_then(
		cacheOption,
		v => result_flatten(result_and_then(
			v,
			q => result_collect(Object.values(q).map(entry => {
				const parsed = resultFromZod(watchOutParseIdToken.safeParse(entry.id_token));
				return result_and_then(parsed, claims => [claims, entry.id_token] as const);
			}))
		))
	);

	const tokenOption = option_flatten(option_and_then(
		idTokens,
		ts => result_to_option(
			result_flatten(
				result_and_then(
					ts,
					pairs => {
						const match = pairs.find(([claims]) => claims.iss === effectiveIssuer && isUnexpiredIDToken(claims));
						return match ? Ok(match[1]) : Err(new Error("no matching token"));
					}
				)
			)
		)
	));

	const cachedToken = option_unwrap_or(tokenOption, null);
	return localToken ?? cachedToken;
}, [authCache, effectiveIssuer, localToken]);

	return [token, requestURL, beginLogin, isAuthenticating];
}
