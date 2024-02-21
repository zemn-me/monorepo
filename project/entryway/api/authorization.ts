import * as trpcNext from '@trpc/server/adapters/next';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { z } from 'zod';

import { db } from '#root/project/entryway/api/model.js';

const allowedIssuers = z.enum(['https://acounts.google.com']);
const audience = 'fixme' as const;
const audienceSchema = z.literal(audience);

export const IDTokenClaims = z.object({
	iss: allowedIssuers,
	sub: z.string(),
	aud: audienceSchema,
	exp: z.string().datetime(),
	iat: z.string().datetime(),
	auth_time: z.string().datetime().optional(),
	nonce: z.string().optional(),
	acr: z.string().optional(),
	amr: z.array(z.string()),
	azp: z.string().optional(),
});

export const OpenIDConfiguration = <T extends z.ZodTypeAny>(issuer: T) =>
	z.object({
		issuer,
		jwks_uri: z.string().url(),
	});

const parseAndVerifyIDTokenClaims = async (token: string) => {
	const decodedJwt = jwt.decode(token);
	if (decodedJwt === null) throw new Error('invalid jwt');
	if (typeof decodedJwt === 'string') throw new Error('invalid jwt');
	const parsed = await IDTokenClaims.parseAsync(decodedJwt);

	const base = new URL(parsed.iss);
	base.pathname = '/well-known/openid-configuration';

	return await new Promise<jwt.JwtPayload>((ok, err) =>
		jwt.verify(
			token,
			(header, callback) =>
				void (async () =>
					callback(
						null,
						(
							await jwksClient({
								jwksUri: (
									await OpenIDConfiguration(
										z.literal(parsed.iss)
									).parseAsync(
										fetch(base).then(r => r.json())
									)
								).jwks_uri,
							}).getSigningKey(header.kid)
						).getPublicKey()
					))(),
			{
				audience,
			},
			(E, decoded) => {
				if (E) return err(E);
				if (decoded === undefined || typeof decoded === 'string')
					return err(new Error('invalid jwt'));
				ok(decoded);
			}
		)
	);
};

const authHeaderParts = z.tuple([
	z.literal('bearer'),
	z.literal('id_token'),
	z.string(),
]);

export async function createAuthorizationContext({
	req,
}: trpcNext.CreateNextContextOptions) {
	if (!req.headers.authorization) return { user: undefined };

	const [, , id_token] = await authHeaderParts.parseAsync(
		req.headers.authorization.split(' ')
	);

	const claims = await parseAndVerifyIDTokenClaims(id_token);

	return {
		user: (
			await db.authenticationLink.findFirst({
				where: {
					iss: claims.iss,
					sub: claims.sub,
					enabled: true,
				},
				select: {
					User: true,
				},
			})
		)?.User,
	};
}

export type Context = Awaited<ReturnType<typeof createAuthorizationContext>>;
