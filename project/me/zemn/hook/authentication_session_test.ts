import { expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import { ZEMN_ME_QUERY_CACHE_STORAGE_KEY } from '#root/project/me/zemn/constants/constants.js';
import {
	oidcSessionQueryKey,
	readOIDCIdTokenHint,
	readOIDCLoginHints,
	readOIDCSession,
	resetAuthenticationSession,
} from './authentication_session.js';

const issuer = 'https://issuer.example';
const clientId = 'client-id';

it('logs out by retaining only an ID-token hint and the session clock', () => {
	const queryClient = new QueryClient();
	queryClient.setQueryData(['use-oidc', issuer], { id_token: 'active' });
	queryClient.setQueryData(['get', '/journal'], { private: true });
	window.localStorage.setItem(
		ZEMN_ME_QUERY_CACHE_STORAGE_KEY,
		'persisted-active-session'
	);

	resetAuthenticationSession({
		clientId,
		idTokenHint: 'latest-id-token',
		issuer,
		nextSession: 1,
		queryClient,
		storage: window.localStorage,
	});

	expect(readOIDCIdTokenHint(window.localStorage, issuer, clientId)).toBe(
		'latest-id-token'
	);
	expect(
		queryClient.getQueryData(oidcSessionQueryKey(issuer, clientId))
	).toBe(1);
	expect(readOIDCSession(window.localStorage, issuer, clientId)).toBe(1);
	expect(queryClient.getQueryData(['use-oidc', issuer])).toBeUndefined();
	expect(queryClient.getQueryData(['get', '/journal'])).toBeUndefined();
	expect(
		window.localStorage.getItem(ZEMN_ME_QUERY_CACHE_STORAGE_KEY)
	).toBeNull();
});

it('clears the ID-token hint when switching users', () => {
	const queryClient = new QueryClient();
	resetAuthenticationSession({
		clientId,
		idTokenHint: 'old-id-token',
		issuer,
		nextSession: 1,
		queryClient,
		storage: window.localStorage,
	});

	resetAuthenticationSession({
		clientId,
		idTokenHint: null,
		issuer,
		nextSession: 2,
		queryClient,
		storage: window.localStorage,
	});

	expect(
		readOIDCIdTokenHint(window.localStorage, issuer, clientId)
	).toBeNull();
});

it('derives a Google subject from a saved token after logout and reload', () => {
	const storage = window.localStorage;
	const google = 'https://accounts.google.com';
	const rawToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'old-subject', exp: 1 })).toString('base64url')}.`;
	const queryClient = new QueryClient();
	storage.clear();
	queryClient.setQueryData(['private-data'], 'secret');
	resetAuthenticationSession({
		clientId,
		issuer: google,
		idTokenHint: rawToken,
		nextSession: 1,
		queryClient,
		storage,
	});
	expect(readOIDCLoginHints(storage, google, clientId)).toEqual({
		login_hint: 'old-subject',
	});
	expect(readOIDCIdTokenHint(storage, google, clientId)).toBe(rawToken);
	expect(readOIDCLoginHints(storage, google, 'another-client')).toEqual({});
	expect(readOIDCLoginHints(storage, issuer, clientId)).toEqual({});
	expect(queryClient.getQueryData(['private-data'])).toBeUndefined();
	resetAuthenticationSession({
		clientId,
		issuer: google,
		idTokenHint: null,
		nextSession: 2,
		queryClient,
		storage,
	});
	expect(readOIDCLoginHints(storage, google, clientId)).toEqual({});
});

it.each(['https://accounts.google.com', 'accounts.google.com'])(
	'ignores malformed saved Google tokens without sending id_token_hint for %s',
	configuredIssuer => {
		const storage = window.localStorage;
		storage.clear();
		storage.setItem(
			`zemn-me-oidc-id-token-hint:${configuredIssuer}:${clientId}`,
			'malformed'
		);
		expect(readOIDCLoginHints(storage, configuredIssuer, clientId)).toEqual(
			{}
		);
	}
);

it('ignores legacy subjects without a raw token and clears them on session reset', () => {
	const storage = window.localStorage;
	const google = 'https://accounts.google.com';
	const legacyKey = `zemn-me-oidc-login-hint:${google}:${clientId}`;
	storage.clear();
	storage.setItem(legacyKey, 'legacy-subject');
	expect(readOIDCLoginHints(storage, google, clientId)).toEqual({});
	resetAuthenticationSession({
		clientId,
		issuer: google,
		idTokenHint: null,
		nextSession: 1,
		queryClient: new QueryClient(),
		storage,
	});
	expect(storage.getItem(legacyKey)).toBeNull();
});

it('retains the raw token fallback for issuers without a selector', () => {
	const storage = window.localStorage;
	storage.clear();
	resetAuthenticationSession({
		clientId,
		issuer,
		idTokenHint: 'opaque-token',
		nextSession: 1,
		queryClient: new QueryClient(),
		storage,
	});
	expect(readOIDCLoginHints(storage, issuer, clientId)).toEqual({
		id_token_hint: 'opaque-token',
	});
});
