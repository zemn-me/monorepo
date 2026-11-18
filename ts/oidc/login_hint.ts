import { decodeJwt, type JWTPayload } from 'jose';
import { z } from 'zod';

// Google documents login_hint accepting the stable subject, without email matching:
// https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters
const googleSubject = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[\x21-\x7e]+$/);
const loginHintSelectors: ReadonlyMap<string, (claims: JWTPayload) => string> =
	new Map(
		['https://accounts.google.com', 'accounts.google.com'].map(issuer => [
			issuer,
			claims => googleSubject.parse(claims.sub),
		])
	);

/**
 * Select untrusted account-preselection data, not an authenticated identity.
 * The new login is validated independently; old tokens can be expired or unsigned.
 */
export function selectOIDCLoginHints(
	issuer: string,
	idToken: string | null
): { login_hint?: string; id_token_hint?: string } {
	if (idToken === null) return {};
	// Choose the selector from configuration, never from the old token's claims.
	const selectHint = loginHintSelectors.get(issuer);
	if (!selectHint) return { id_token_hint: idToken };
	try {
		return { login_hint: selectHint(decodeJwt(idToken)) };
	} catch {
		// A malformed optional hint must not prevent login. In particular, Google
		// must not fall back to the unsupported id_token_hint parameter.
		return {};
	}
}
