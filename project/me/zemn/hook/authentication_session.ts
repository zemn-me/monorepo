import { QueryClient, QueryKey } from '@tanstack/react-query';

import { ZEMN_ME_QUERY_CACHE_STORAGE_KEY } from '#root/project/me/zemn/constants/constants.js';

const oidcSessionQueryKeyPrefix = 'oidc-active-session';
const oidcSessionStorageKeyPrefix = 'zemn-me-oidc-session';
const oidcIdTokenHintStorageKeyPrefix = 'zemn-me-oidc-id-token-hint';

export function oidcSessionQueryKey(
	issuer: string,
	clientId: string
): QueryKey {
	return [oidcSessionQueryKeyPrefix, issuer, clientId];
}

function oidcIdTokenHintStorageKey(issuer: string, clientId: string) {
	return `${oidcIdTokenHintStorageKeyPrefix}:${issuer}:${clientId}`;
}

function oidcSessionStorageKey(issuer: string, clientId: string) {
	return `${oidcSessionStorageKeyPrefix}:${issuer}:${clientId}`;
}

export function readOIDCSession(
	storage: Pick<Storage, 'getItem'>,
	issuer: string,
	clientId: string
) {
	const stored = storage.getItem(oidcSessionStorageKey(issuer, clientId));
	const parsed = stored === null ? 0 : Number.parseInt(stored, 10);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function readOIDCIdTokenHint(
	storage: Pick<Storage, 'getItem'>,
	issuer: string,
	clientId: string
) {
	return storage.getItem(oidcIdTokenHintStorageKey(issuer, clientId));
}

export interface ResetAuthenticationSessionOptions {
	readonly clientId: string;
	readonly idTokenHint: string | null;
	readonly issuer: string;
	readonly nextSession: number;
	readonly queryClient: QueryClient;
	readonly storage: Pick<Storage, 'removeItem' | 'setItem'>;
}

/** Ends the application session, retaining only the optional login hint. */
export function resetAuthenticationSession({
	clientId,
	idTokenHint,
	issuer,
	nextSession,
	queryClient,
	storage,
}: ResetAuthenticationSessionOptions) {
	// The persister is throttled, so remove its previous snapshot synchronously;
	// a tab closed immediately after logout must not restore the old session.
	storage.removeItem(ZEMN_ME_QUERY_CACHE_STORAGE_KEY);
	const hintKey = oidcIdTokenHintStorageKey(issuer, clientId);
	if (idTokenHint === null) storage.removeItem(hintKey);
	else storage.setItem(hintKey, idTokenHint);
	storage.setItem(
		oidcSessionStorageKey(issuer, clientId),
		nextSession.toString()
	);

	void queryClient.cancelQueries({
		predicate: query => query.queryKey[0] !== oidcSessionQueryKeyPrefix,
	});
	// Move observers to a fresh session before removing old authenticated data.
	queryClient.setQueryData(
		oidcSessionQueryKey(issuer, clientId),
		nextSession
	);
	queryClient.removeQueries({
		predicate: query => query.queryKey[0] !== oidcSessionQueryKeyPrefix,
	});
	queryClient.getMutationCache().clear();
}
