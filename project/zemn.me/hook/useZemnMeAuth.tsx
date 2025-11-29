import { FOREIGN_ID_TOKEN_ISSUER } from '#root/project/zemn.me/constants/constants.js';
import { useExchangeToken } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import {
	OAuthClientByIssuer,
} from '#root/project/zemn.me/OAuth/clients.js';
import { useOIDC as useGenericOIDC } from '#root/ts/oidc/useOIDC.js';
import * as option from '#root/ts/option/types.js';
import * as future from '#root/ts/result/react-query/future.js'

const ALL_API_SCOPES = [
	'callbox.read',
	'callbox.write',
	'grievances.read',
	'grievances.write',
	'admin.read',
];

type UseZemnMeAuthOptions = {
	readonly scopes?: readonly string[];
};



export function useZemnMeAuth(options: UseZemnMeAuthOptions = {}) {
	const apiScopes = options.scopes ?? ALL_API_SCOPES; // TODO: should come from config
	const issuer = FOREIGN_ID_TOKEN_ISSUER; // foreign issuer
	const oauthClient = OAuthClientByIssuer(issuer);

	// Perform implicit flow against the upstream issuer to obtain an id_token.
	const [, idToken, promptForLogin] = useGenericOIDC(option.Some({
		issuer,
		client_id: oauthClient.clientId,
		response_type: 'code token id_token',
		scope: 'openid',
	}));


	const access_token_exchange = useExchangeToken(
		future.and_then(
			idToken,
			token => ({
				grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
				requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
				subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
				subject_token: token,
				scope: apiScopes.join(' '),
			})
		),
		['oidc-access-token', issuer, ...apiScopes],
	);

	const access_token = future.field(access_token_exchange, 'access_token');


	const id_token_exchange = useExchangeToken(
		future.and_then(
			idToken,
			token => ({
				grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
				requested_token_type: 'urn:ietf:params:oauth:token-type:id_token',
				subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
				subject_token: token,
			})
		),
		['oidc-id-token', issuer, ...apiScopes],
	);

	const id_token = future.field(id_token_exchange, 'access_token');

	return [access_token, id_token, promptForLogin] as const;
}
