import { expect, it, jest } from '@jest/globals';
import { selectOIDCLoginHints } from './login_hint.js';

const issuer = 'https://accounts.google.com';

function token(claims: unknown) {
	return `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
}

it.each([issuer, 'accounts.google.com'])(
	'derives a Google subject synchronously from an old unverified token for %s',
	configuredIssuer => {
		const oldToken = token({
			iss: issuer,
			sub: 'old-subject',
			aud: 'old-client',
			nonce: 'old-nonce',
			exp: 1,
		});
		expect(selectOIDCLoginHints(configuredIssuer, oldToken)).toEqual({
			login_hint: 'old-subject',
		});
	}
);

it('uses configured issuer selection, not untrusted token issuer claims', () => {
	const saved = token({ iss: 'https://other.example', sub: 'account' });
	expect(selectOIDCLoginHints(issuer, saved)).toEqual({
		login_hint: 'account',
	});
	const claimsGoogle = token({ iss: issuer, sub: 'account' });
	expect(selectOIDCLoginHints('https://other.example', claimsGoogle)).toEqual(
		{
			id_token_hint: claimsGoogle,
		}
	);
});

it('does not verify the signature of optional account-preselection data', () => {
	const forged = `${token({ sub: 'untrusted-subject' })}invalid-signature`;
	expect(selectOIDCLoginHints(issuer, forged)).toEqual({
		login_hint: 'untrusted-subject',
	});
});

it.each([
	{},
	{ sub: '' },
	{ sub: 123 },
	{ sub: null },
	{ sub: 'a'.repeat(256) },
	{ sub: 'subject\n' },
	{ sub: 'two words' },
	{ sub: 'é' },
	{ email: 'same@example.com', email_verified: true },
])('omits both Google hints for an unusable subject: %j', claims => {
	expect(selectOIDCLoginHints(issuer, token(claims))).toEqual({});
});

it.each(['', 'malformed', 'a.b', 'a.b.c.d', 'a.!.c', 'a.bm90LWpzb24.c'])(
	'omits both Google hints for malformed tokens: %s',
	saved => {
		expect(selectOIDCLoginHints(issuer, saved)).toEqual({});
	}
);

it.each([null, [], 'not an object'])(
	'omits both Google hints for a non-object payload: %j',
	claims => {
		expect(selectOIDCLoginHints(issuer, token(claims))).toEqual({});
	}
);

it.each([
	'https://other.example',
	'https://accounts.google.com.evil.example',
	'https://accounts.google.com/',
])(
	'passes the original token through unchanged without a selector for %s',
	configuredIssuer => {
		expect(selectOIDCLoginHints(configuredIssuer, 'opaque-token')).toEqual({
			id_token_hint: 'opaque-token',
		});
	}
);

it.each([issuer, 'https://other.example'])(
	'omits hints when no token is saved for %s',
	configuredIssuer => {
		expect(selectOIDCLoginHints(configuredIssuer, null)).toEqual({});
	}
);

it('selects a hint without fetching keys or other network data', () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockRejectedValue(new Error('offline'));
	try {
		expect(selectOIDCLoginHints(issuer, token({ sub: 'account' }))).toEqual(
			{
				login_hint: 'account',
			}
		);
		expect(fetch).not.toHaveBeenCalled();
	} finally {
		fetch.mockRestore();
	}
});
