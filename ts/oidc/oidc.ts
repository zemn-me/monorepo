import b64 from 'base64-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import { Err, Ok, and_then as result_and_then, flatten as result_flatten, Result, result_promise_transpose, zip as result_zip } from '#root/ts/result_types.js';
import { resultFromZod } from '#root/ts/zod/util.js';







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


type OpenIDProviderConfiguration = {
	authorization_endpoint: string;
	jwks_uri: string;
};

const openidConfigCache = new Map<string, Promise<Result<OpenIDProviderConfiguration, Error>>>();

async function getOpenidConfig(issuer: URL): Promise<Result<OpenIDProviderConfiguration, Error>> {
	const key = issuer.toString();
	const cached = openidConfigCache.get(key);
	if (cached) {
		return cached;
	}

	const configPromise = (async () => {
		try {
			const wellKnown = new URL('.well-known/openid-configuration', issuer);
			const response = await fetch(wellKnown.toString());
			if (!response.ok) {
				return Err(new Error(`failed to fetch openid configuration (${response.status})`));
			}
			const json = await response.json();
			if (typeof json.authorization_endpoint !== 'string' || typeof json.jwks_uri !== 'string') {
				return Err(new Error('invalid openid configuration response'));
			}
			return Ok({
				authorization_endpoint: json.authorization_endpoint,
				jwks_uri: json.jwks_uri,
			});
		} catch (error) {
			return Err(error instanceof Error ? error : new Error(String(error)));
		}
	})();

	openidConfigCache.set(key, configPromise);
	return configPromise;
}

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

const issuerSchema = z.string().url().refine(
	s => s.startsWith('https://') || s.startsWith('http://localhost'),
	"Issuer must be https:// or http://localhost"
);

export const idTokenSchema = z.object({
	iss: issuerSchema,
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

const base64UrlBytes = z.string().transform((value, ctx) => {
	try {
		const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
		const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
		return b64.toByteArray(normalized + padding);
	} catch (error) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Expected base64url payload',
		});
		return z.NEVER;
	}
});

export const watchOutParseIdToken = z.string()
	.transform(s => s.split("."))
	.pipe(
		z.tuple([z.string(), base64UrlBytes, z.string()])
	).transform(
		([, body]) => new TextDecoder().decode(body)
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
