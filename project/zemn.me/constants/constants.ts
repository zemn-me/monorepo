export const ZEMN_ME_API_BASE = //process.env["NEXT_PUBLIC_ZEMN_ME_API_BASE"] ?? "https://api.zemn.me";
	"https://api.zemn.me";

export const GOOGLE_ISSUER_DOMAIN = process.env["NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER"] ?? "https://accounts.google.com";

const GOOGLE_DEFAULT_CLIENT_ID =
	"845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com";

export const GOOGLE_CLIENT_ID = (() => {
	const testIssuer = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER;
	if (testIssuer && testIssuer.trim() !== "") {
		const testClientId = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_CLIENT_ID;
		if (testClientId && testClientId.trim() !== "") {
			return testClientId;
		}
		throw new Error("Missing NEXT_PUBLIC_ZEMN_TEST_OIDC_CLIENT_ID for test issuer.");
	}
	return GOOGLE_DEFAULT_CLIENT_ID;
})();
