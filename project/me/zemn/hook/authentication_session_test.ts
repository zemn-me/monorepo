import { expect, it } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

import { ZEMN_ME_QUERY_CACHE_STORAGE_KEY } from '#root/project/me/zemn/constants/constants.js';
import {
	oidcSessionQueryKey,
	readOIDCIdTokenHint,
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
