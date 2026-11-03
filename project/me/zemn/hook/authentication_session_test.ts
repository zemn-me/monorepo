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

it('retains a Google subject through logout and reload, then clears it for account switching', () => {
	const storage = window.localStorage;
	const google = 'https://accounts.google.com';
	const queryClient = new QueryClient();
	storage.clear();
	queryClient.setQueryData(['private-data'], 'secret');
	resetAuthenticationSession({
		clientId,
		issuer: google,
		idTokenHint: 'raw-token',
		loginHint: 'verified-google-subject',
		nextSession: 1,
		queryClient,
		storage,
	});
	expect(readOIDCLoginHints(storage, google, clientId)).toEqual({
		login_hint: 'verified-google-subject',
	});
	expect(readOIDCIdTokenHint(storage, google, clientId)).toBeNull();
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

it.each(['https://accounts.google.com', 'accounts.google.com', issuer])(
	'retains the ID-token fallback without a validated hint for %s',
	configuredIssuer => {
		const storage = window.localStorage;
		storage.clear();
		resetAuthenticationSession({
			clientId,
			issuer: configuredIssuer,
			idTokenHint: 'fallback-token',
			nextSession: 1,
			queryClient: new QueryClient(),
			storage,
		});
		expect(readOIDCLoginHints(storage, configuredIssuer, clientId)).toEqual(
			{ id_token_hint: 'fallback-token' }
		);
	}
);

it('does not apply Google hints to other issuers', () => {
	const storage = window.localStorage;
	storage.clear();
	resetAuthenticationSession({
		clientId,
		issuer,
		idTokenHint: 'fallback-token',
		loginHint: 'google-subject',
		nextSession: 1,
		queryClient: new QueryClient(),
		storage,
	});
	expect(readOIDCLoginHints(storage, issuer, clientId)).toEqual({
		id_token_hint: 'fallback-token',
	});
});
