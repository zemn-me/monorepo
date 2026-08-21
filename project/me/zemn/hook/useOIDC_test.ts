import { expect, it } from '@jest/globals';

import { buildOIDCAuthorizationURL } from './oidcAuthorizationURL.js';

it('adds the saved ID token only as an ordinary-login hint', () => {
	const target = new URL(
		'https://accounts.example.com/authorize?client_id=client'
	);
	const request = buildOIDCAuthorizationURL(target, {
		idTokenHint: 'previous-id-token',
	});

	expect(request.searchParams.get('id_token_hint')).toBe('previous-id-token');
	expect(request.searchParams.get('prompt')).toBeNull();
	expect(target.searchParams.get('id_token_hint')).toBeNull();
});

it('forces account selection and removes any token hint when switching users', () => {
	const target = new URL(
		'https://accounts.example.com/authorize?id_token_hint=old-token'
	);
	const request = buildOIDCAuthorizationURL(target, {
		selectAccount: true,
	});

	expect(request.searchParams.get('id_token_hint')).toBeNull();
	expect(request.searchParams.get('prompt')).toBe('select_account');
});
