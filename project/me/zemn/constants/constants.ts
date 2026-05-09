declare global {
	interface ImportMeta {
		readonly env: Record<string, string | undefined>;
	}
}

const env = import.meta.env;
export const ZEMN_ME_API_BASE =
	env['VITE_ZEMN_ME_API_BASE'] ?? 'https://api.zemn.me';

export const GOOGLE_ISSUER_DOMAIN =
	env['VITE_ZEMN_TEST_OIDC_ISSUER'] ?? 'https://accounts.google.com';

const GOOGLE_DEFAULT_CLIENT_ID =
	'845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com';

export const GOOGLE_CLIENT_ID = (() => {
	const testIssuer = env['VITE_ZEMN_TEST_OIDC_ISSUER'];
	if (testIssuer && testIssuer.trim() !== '') {
		const testClientId = env['VITE_ZEMN_TEST_OIDC_CLIENT_ID'];
		if (testClientId && testClientId.trim() !== '') {
			return testClientId;
		}
		throw new Error(
			'Missing VITE_ZEMN_TEST_OIDC_CLIENT_ID for test issuer.'
		);
	}
	return GOOGLE_DEFAULT_CLIENT_ID;
})();
