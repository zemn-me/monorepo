import { GOOGLE_ISSUER_DOMAIN } from '#root/project/zemn.me/constants/constants.js';
import { useOIDC } from '#root/project/zemn.me/hook/useOIDC.js';
import { OAuthClientByIssuer } from '#root/project/zemn.me/OAuth/clients.js';


export function useGoogleAuth(scopes: string[]) {
	const oauthClient = OAuthClientByIssuer(GOOGLE_ISSUER_DOMAIN);
	return useOIDC(GOOGLE_ISSUER_DOMAIN, {
		client_id: oauthClient.clientId,
		scope: scopes.join(' '),
	});
}
