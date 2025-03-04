import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import { and_then as option_and_then } from '#root/ts/option/types.js';
import { and_then as result_and_then } from '#root/ts/result_types.js';
import { resultFromZod } from '#root/ts/zod/util.js';


export const openidConfiguration = z.object({
	issuer: z.string(),
	response_types_supported: z.string().array(),
	subject_types_supported: z.string().array(),
	scopes_supported: z.string().array(),
	claims_supported: z.string().array(),
	authorization_endpoint: z.string().url(),
	jwks_uri: z.string().url(),
});


export const openidConfigPathName = ".well-known/openid-configuration";

// should be cached in future
export const getOpenidConfig = (issuer: URL) => {
	const clone = new URL(issuer);
	clone.pathname = openidConfigPathName;

	return fetch(clone).then(b => b.json())
		.then(json => resultFromZod(openidConfiguration.safeParse(json)))
}

/**
 * Verifies an OIDC token given audience, issuer etc.
 * @param issuer
 * @param token
 * @param audience
 * @param clockToleranceSeconds
 */
export async function verifyOIDCToken(
	token: string,
	issuer: string,
	audience: string,
	clockToleranceSeconds: number
) {
	const config = getOpenidConfig(new URL(issuer));
	const jwks = result_and_then(
		await config,
		c => createRemoteJWKSet(new URL(c.jwks_uri))
	);

	return result_and_then(
		jwks,
		jwks => jwtVerify(
			token,
			jwks,
			{ issuer, audience, clockTolerance: clockToleranceSeconds }
		)
	)

}

export async function oidcAuthorizeUri(
	nonce: string, state: string, callback: URL, clientId: string, issuer: URL) {
	const config = await getOpenidConfig(issuer);

	return result_and_then(
		config,
		c => {
			const base = new URL(c.authorization_endpoint);

			base.search = new URLSearchParams({
				response_type: 'id_token',
				client_id: clientId,
				redirect_uri: callback.toString(),
				scope: 'openid',
				nonce,
				state,
			}).toString();

			return base;
		}
	)
}
