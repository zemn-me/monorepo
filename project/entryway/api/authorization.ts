import { TRPCError } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { z } from 'zod';

import { db } from '#root/project/entryway/api/db.js';

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

const idTokenAuthHeaderParts = z.tuple([
	z.literal('bearer'),
	z.literal('id_token'),
	z.string(),
]);

const serviceKeyAuthParts = z.tuple([
	z.literal('bearer'),
	z.literal('service_key'),
	z.string(),
]);

const authHeaderParts = z.union([idTokenAuthHeaderParts, serviceKeyAuthParts]);

export async function createAuthorizationContext({
	req,
}: trpcNext.CreateNextContextOptions) {
	if (!req.headers.authorization) return { user: undefined };

	const [, kind, key] = await authHeaderParts.parseAsync(
		req.headers.authorization.split(' ')
	);

	if (kind === 'service_key') {
		if (!process.env['SERVICE_KEY_SECRET'])
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message:
					'misconfigured service -- needs SERVICE_KEY_SECRET set.',
			});

		if (key !== process.env['SERVICE_KEY_SECRET'])
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'invalid or incorrect service key secret',
			});

		return {
			service: true,
		};
	}

	const claims = await parseAndVerifyIDTokenClaims(key);

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
