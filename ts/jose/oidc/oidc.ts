import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import { and_then } from '#root/ts/result_types.js';
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
const getOpenidConfig = (issuer: URL) => {
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
	const jwks = and_then(
		await config,
		c => createRemoteJWKSet(new URL(c.jwks_uri))
	);

	return and_then(
		jwks,
		jwks => jwtVerify(
			token,
			jwks,
			{ issuer, audience, clockTolerance: clockToleranceSeconds }
		)
	)

}
