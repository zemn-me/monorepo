import { z } from "zod";

/**
 * Helpers
 */
const NumericDate = z
	.number()
	.int()
	.nonnegative()
	.describe("Seconds since 1970-01-01T00:00:00Z");

const Issuer = z
	.string()
	.url()
	.refine((u) => {
		try {
			const url = new URL(u);
			console.log(url);
			return (
				(
					url.protocol === "https:" ||
					url.protocol === "http:"
				) &&
				!!url.hostname &&
				url.username === "" &&
				url.password === "" &&
				url.search === "" &&
				url.hash === ""
			);
		} catch {
			return false;
		}
	}, "iss must be an https URL with no query/fragment")
	.describe("Issuer Identifier");

const Subject = z
	.string()
	// OIDC says ASCII and <= 255 chars. Zod can enforce length; ASCII check here is a pragmatic approximation.
	.max(255)
	.refine((s) => /^[\x00-\x7F]*$/.test(s), "sub must be ASCII")
	.describe("Subject Identifier");

const Aud = z
	.union([z.string(), z.array(z.string()).nonempty()])
	.describe("Audience (string or non-empty array of strings)");

/**
 * Core OIDC ID Token claims schema (JWT Claims Set).
 *
 * Notes:
 * - Some claims become REQUIRED depending on flow / request:
 *   - nonce: REQUIRED in Implicit Flow; otherwise REQUIRED if nonce was sent in auth request.
 *   - auth_time: REQUIRED if max_age was used or auth_time was requested as essential.
 *   - at_hash/c_hash: REQUIRED in some hybrid/implicit cases (see below).
 * - Unknown claims MUST be ignored -> `.passthrough()`.
 */
export const OidcIdTokenClaimsSchema = z
	.object({
		iss: Issuer,
		sub: Subject,
		aud: Aud,

		exp: NumericDate,
		iat: NumericDate,

		auth_time: NumericDate.optional(),
		nonce: z.string().optional(),

		acr: z.string().optional(),
		amr: z.array(z.string()).optional(),

		azp: z.string().optional(),

		// Per-flow extras:
		at_hash: z.string().optional(),
		c_hash: z.string().optional(),
		name: z.string().optional(),
		given_name: z.string().optional(),
		family_name: z.string().optional(),
		middle_name: z.string().optional(),
		nickname: z.string().optional(),
		preferred_username: z.string().optional(),
		picture: z.string().url().optional(),
	});

/**
 * Optional: add validation helpers for common RP checks that are *not* pure schema checks
 * (because they require configuration / request context).
 */
export function validateIdTokenClaims(
	claims: unknown,
	opts: {
		expectedIssuer: string;
		clientId: string;
		// set if you sent a nonce in the auth request
		expectedNonce?: string;
		// set if you want to require auth_time (e.g. max_age used)
		requireAuthTime?: boolean;
		// set if azp should be checked when present
		requireAzpToMatchClientId?: boolean;
	},
) {
	const parsed = OidcIdTokenClaimsSchema.parse(claims);

	if (parsed.iss !== opts.expectedIssuer) {
		throw new Error(`iss mismatch`);
	}

	const audOk =
		typeof parsed.aud === "string"
			? parsed.aud === opts.clientId
			: parsed.aud.includes(opts.clientId);
	if (!audOk) {
		throw new Error(`aud does not contain client_id`);
	}

	if (opts.expectedNonce !== undefined) {
		if (parsed.nonce !== opts.expectedNonce) {
			throw new Error(`nonce mismatch`);
		}
	}

	if (opts.requireAuthTime) {
		if (parsed.auth_time === undefined) {
			throw new Error(`auth_time required but missing`);
		}
	}

	if (opts.requireAzpToMatchClientId && parsed.azp !== undefined) {
		if (parsed.azp !== opts.clientId) {
			throw new Error(`azp mismatch`);
		}
	}

	return parsed;
}
