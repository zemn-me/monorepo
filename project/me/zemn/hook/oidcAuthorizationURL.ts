export function buildOIDCAuthorizationURL(
	target: URL,
	options:
		| { readonly idTokenHint?: string; readonly selectAccount?: false }
		| { readonly selectAccount: true }
) {
	const requestURL = new URL(target);
	if (options.selectAccount) {
		requestURL.searchParams.delete('id_token_hint');
		requestURL.searchParams.set('prompt', 'select_account');
	} else if (options.idTokenHint !== undefined) {
		requestURL.searchParams.set('id_token_hint', options.idTokenHint);
	}
	return requestURL;
}
