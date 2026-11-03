import { beforeAll, expect, it } from '@jest/globals';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createOIDCLoginHintResolver } from './login_hint.js';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let resolveHint: ReturnType<typeof createOIDCLoginHintResolver>;
const issuer = 'https://accounts.google.com';
const client = 'client';
const nonce = 'request-nonce';

beforeAll(async () => {
	keys = await generateKeyPair('RS256');
	resolveHint = createOIDCLoginHintResolver(
		createLocalJWKSet({
			keys: [
				{
					...(await exportJWK(keys.publicKey)),
					kid: 'test',
					alg: 'RS256',
				},
			],
		})
	);
});

async function token(overrides: Record<string, unknown> = {}) {
	return new SignJWT({
		iss: issuer,
		sub: 'google-subject',
		aud: client,
		nonce,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600,
		...overrides,
	})
		.setProtectedHeader({ alg: 'RS256', kid: 'test' })
		.sign(keys.privateKey);
}

it.each([issuer, 'accounts.google.com'])(
	'uses a verified Google subject for %s',
	async iss => {
		expect(
			await resolveHint(issuer, client, await token({ iss }), nonce)
		).toBe('google-subject');
		expect(
			await resolveHint(iss, client, await token({ iss }), nonce)
		).toBe('google-subject');
	}
);

it.each([
	{ sub: undefined },
	{ sub: '' },
	{ sub: 123 },
	{ sub: 'a'.repeat(256) },
	{ sub: 'subject\n' },
	{ iss: 'https://accounts.google.com.evil.example' },
	{ iss: 'https://accounts.google.com/' },
	{ aud: 'other-client' },
	{ nonce: undefined },
	{ nonce: 'other-request' },
	{ exp: 1 },
	{ exp: undefined },
	{ iat: undefined },
	{ iat: 9999999999 },
	{ azp: 'other-client' },
	{ aud: [client, 'other-client'] },
	{ sub: undefined, email: 'same@example.com', email_verified: true },
])('does not derive a hint from invalid claims: %j', async claims => {
	expect(
		await resolveHint(issuer, client, await token(claims), nonce)
	).toBeUndefined();
});

it('accepts multiple audiences only with the matching authorized party', async () => {
	expect(
		await resolveHint(
			issuer,
			client,
			await token({ aud: [client, 'other'], azp: client }),
			nonce
		)
	).toBe('google-subject');
});

it('rejects malformed and forged tokens', async () => {
	expect(
		await resolveHint(issuer, client, 'malformed', nonce)
	).toBeUndefined();
	const otherKeys = await generateKeyPair('RS256');
	const forged = await new SignJWT({
		iss: issuer,
		sub: 'forged',
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600,
		aud: client,
		nonce,
	})
		.setProtectedHeader({ alg: 'RS256', kid: 'test' })
		.sign(otherKeys.privateKey);
	expect(await resolveHint(issuer, client, forged, nonce)).toBeUndefined();
});

it.each([
	'https://other.example',
	'https://accounts.google.com.evil.example',
	'https://accounts.google.com/',
])('has no strategy for %s', async configuredIssuer => {
	expect(
		await resolveHint(configuredIssuer, client, await token(), nonce)
	).toBeUndefined();
});

it('leaves the fallback available when key retrieval fails', async () => {
	const unavailable = createOIDCLoginHintResolver(async () => {
		throw new Error('offline');
	});
	expect(
		await unavailable(issuer, client, await token(), nonce)
	).toBeUndefined();
});

it('rejects tokens using an unapproved signature algorithm', async () => {
	const raw = await new SignJWT({
		iss: issuer,
		sub: 'subject',
		aud: client,
		nonce,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600,
	})
		.setProtectedHeader({ alg: 'HS256' })
		.sign(new Uint8Array(32));
	expect(await resolveHint(issuer, client, raw, nonce)).toBeUndefined();
});
