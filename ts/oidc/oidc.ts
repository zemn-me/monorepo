import b64 from 'base64-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { array, base64, number, object, optional, output, pipe, string, transform, tuple, union, url } from 'zod/v4-mini';

import { and_then, Err, flatten, Ok, Result, result_promise_transpose, zip } from '#root/ts/result/result.js';


export const openidConfiguration = object({
	issuer: string(),
	response_types_supported: array(string()),
	subject_types_supported: array(string()),
	scopes_supported: array(string()),
	claims_supported: array(string()),
	authorization_endpoint: url(),
	jwks_uri: url(),
});


export const openidConfigPathName = ".well-known/openid-configuration";

// should be cached in future
export const getOpenidConfig = (issuer: URL) => {
	const clone = new URL(issuer);
	clone.pathname = openidConfigPathName;

	return fetch(clone).then(b => b.json())
		.then(json => openidConfiguration.safeParse(json))
		.then(v => v.success? Ok(v.data): Err(v.error))
}

const jwtb64Parts = pipe(
	pipe(
	string(),
	transform(string => string.split(".")),
	),
	tuple([base64(), base64(), base64()])
);

const jwtUnsafeBody = pipe(
	jwtb64Parts,
	transform(([, body]) =>
		JSON.parse(new TextDecoder().decode(b64.toByteArray(body)))
))

const jwtUnsafeIssuer = pipe(
	jwtUnsafeBody,
	object({ iss: string() })
)


function issuerForIdToken(
	token: string
) {
	const v = jwtUnsafeIssuer.safeParse(token);

	return v.success ?
		Ok(v.data) : Err(v.error);
}

/**
 * Verifies an OIDC id_token *without* specifying the issuer.
 */
export async function watch_out_i_am_verifying_the_id_token_with_no_specified_issuer<E>(
	token: string,
	getAudience: (iss: string) => Result<string, E>,
	clockToleranceSeconds: number
) {
	const issuer = and_then(
		issuerForIdToken(token),
		v => v.iss
	)

	const audience = flatten(and_then(
		issuer,
		issuer => getAudience(issuer)
	));

	const audience_issuer = zip(audience, issuer);

	const verification = and_then(
		audience_issuer,
		([audience, issuer]) => verifyOIDCToken(
			token,
			issuer,
			audience,
			clockToleranceSeconds
		)
	)

	const promise = result_promise_transpose(verification)
	return promise;

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

	const verified_jwt = and_then(
		jwks,
		jwks => jwtVerify(
			token,
			jwks,
			{ issuer, audience, clockTolerance: clockToleranceSeconds }
		)
	)

	const promise = result_promise_transpose(verified_jwt);

	return promise;
}

export const idTokenSchema = object({
	iss: url(),
	sub: string,
	aud: union([string(), array(string())]),
	exp: number(),
	iat: number(),
	auth_time: optional(number()),
	nonce: optional(string()),
	acr: optional(string()),
	amr: optional(array(string())),
	azp: optional(string()),
});

export type ID_Token = output<typeof idTokenSchema>;

export const watchOutParseIdToken = pipe(
	jwtUnsafeBody,
	idTokenSchema
)

export async function oidcAuthorizeUri(
	nonce: string, state: string, callback: URL, clientId: string, issuer: URL) {
	const config = await getOpenidConfig(issuer);

	return and_then(
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
