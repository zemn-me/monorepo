import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { z } from 'zod';

const googleIssuers = ['https://accounts.google.com', 'accounts.google.com'];
// Google documents login_hint accepting the stable subject, without email matching:
// https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters
const googleClaims = z.object({
	iss: z.enum(['https://accounts.google.com', 'accounts.google.com']),
	sub: z
		.string()
		.min(1)
		.max(255)
		.regex(/^[\x21-\x7e]+$/),
	iat: z.number().int().nonnegative(),
	exp: z.number().int().nonnegative(),
	nonce: z.string(),
	azp: z.string().optional(),
});

/** Only claims that have passed signature and request-context validation. */
type ValidatedGoogleClaims = z.infer<typeof googleClaims>;
const loginHintStrategies: ReadonlyMap<
	string,
	(claims: ValidatedGoogleClaims) => string
> = new Map(googleIssuers.map(issuer => [issuer, claims => claims.sub]));

export function hasOIDCLoginHintStrategy(issuer: string) {
	return loginHintStrategies.has(issuer);
}

/** The key resolver is trusted configuration, never selected from JWT claims. */
export function createOIDCLoginHintResolver(
	googleKeys: JWTVerifyGetKey = createRemoteJWKSet(
		new URL('https://www.googleapis.com/oauth2/v3/certs')
	)
) {
	return async (
		issuer: string,
		clientId: string,
		idToken: string,
		nonce: string
	): Promise<string | undefined> => {
		const strategy = loginHintStrategies.get(issuer);
		if (!strategy) return undefined;
		try {
			const { payload } = await jwtVerify(idToken, googleKeys, {
				algorithms: ['RS256'],
				issuer: googleIssuers,
				audience: clientId,
				requiredClaims: ['iss', 'sub', 'aud', 'iat', 'exp', 'nonce'],
			});
			const claims = googleClaims.parse(payload);
			if (claims.nonce !== nonce) return undefined;
			if (claims.azp !== undefined && claims.azp !== clientId)
				return undefined;
			if (
				Array.isArray(payload.aud) &&
				payload.aud.length > 1 &&
				!claims.azp
			)
				return undefined;
			if (claims.iat > Date.now() / 1000) return undefined;
			return strategy(claims);
		} catch {
			// Hints are optional. Verification/network failures leave authentication
			// to the existing API exchange and retain the ID-token hint fallback.
			return undefined;
		}
	};
}

export const resolveOIDCLoginHint = createOIDCLoginHintResolver();
