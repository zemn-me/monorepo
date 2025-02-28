import { AuthorizationCache } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Issuer } from "#root/project/zemn.me/OAuth/clients.js";
import { and_then } from "#root/ts/result_types.js";

export function useOIDC(issuer: Issuer) {
	const [, authCache] = AuthorizationCache();

	const ourToken = and_then(authCache, v => 1)



}
