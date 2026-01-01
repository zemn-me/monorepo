import { GOOGLE_CLIENT_ID, GOOGLE_ISSUER_DOMAIN } from '#root/project/zemn.me/constants/constants.js';
import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';

export function useGoogleAuth(scopes: string[]) {
	return useOIDC(GOOGLE_ISSUER_DOMAIN, {
		client_id: GOOGLE_CLIENT_ID,
		scope: scopes.join(' '),
	});
}
