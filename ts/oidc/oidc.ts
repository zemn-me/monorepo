import b64 from 'base64-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import { and_then as result_and_then, flatten as result_flatten, Result, result_promise_transpose, zip as result_zip } from '#root/ts/result_types.js';
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
 * Parse a JSON string, then validate/shape it with `schema`.
 * Usage: const Parsed = stringToJSON(z.object({ ... }));
 */
export const stringToJSON =
  z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a valid JSON string.",
      });
      return z.NEVER;
    }
  })


const unsafeJwtIssParser = z.string().transform(
	s => s.split(".")
).pipe(
	z.tuple([z.string(), z.string(), z.string()])
).transform(([, body]) => b64.toByteArray(body))
.transform(b => new TextDecoder().decode(b))
	.pipe(
	stringToJSON
).pipe(
	z.object({
		iss: z.string()
	})
).transform(o => o.iss);

function issuerForIdToken(
	token: string
) {
	return resultFromZod(unsafeJwtIssParser.safeParse(token));
}

/**
 * Verifies an OIDC id_token *without* specifying the issuer.
 */
export async function watch_out_i_am_verifying_the_id_token_with_no_specified_issuer<E> (
	token: string,
	getAudience: (iss: string) => Result<string, E>,
	clockToleranceSeconds: number
) {
	const issuer =
		issuerForIdToken(token);

	const audience = result_flatten(result_and_then(
		issuer,
		issuer => getAudience(issuer)
	));

	return result_promise_transpose(result_and_then(
		result_zip(audience, issuer),
		([audience, issuer]) => verifyOIDCToken(
			token,
			issuer,
			audience,
			clockToleranceSeconds
		)
	)).then( v => result_promise_transpose( result_flatten(v) ))
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

export const idTokenSchema = z.object({
	iss: z.string().url().startsWith('https://'),
	sub: z.string().max(255),
	aud: z.union([z.string(), z.array(z.string()).nonempty()]),
	exp: z.number().int().positive(),
	iat: z.number().int().positive(),
	auth_time: z.number().int().positive().optional(),
	nonce: z.string().optional(),
	acr: z.string().optional(),
	amr: z.array(z.string()).optional(),
	azp: z.string().optional(),
});

export type ID_Token = z.TypeOf<typeof idTokenSchema>;

export const watchOutParseIdToken = z.string()
	.transform(s => s.split("."))
	.pipe(
		z.tuple([z.string(), z.string(), z.string()])
	).transform(
		([, body]) => atob(body)
	).pipe(
		stringToJSON
	).pipe(idTokenSchema);


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
