export interface Client {
	readonly clientId: string
	readonly issuer: string
	readonly name: string
}

const clientMap = new Map<string, Client>();

clientMap.set("https://accounts.google.com", {
	name: "Google",
});

const testIssuer = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_ISSUER;
if (testIssuer && testIssuer.trim() !== "") {
	const testClientId = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_CLIENT_ID;
	const testName = process.env.NEXT_PUBLIC_ZEMN_TEST_OIDC_NAME;
	if (
		testClientId &&
		testClientId.trim() !== "" &&
		testName &&
		testName.trim() !== ""
	) {
		clientMap.set(testIssuer, {
			issuer: testIssuer,
			clientId: testClientId,
			name: testName,
		});
	}
}

export const clients: readonly Client[] = Array.from(clientMap.values());

export function OAuthClientByIssuer(issuer: string): Client {
	const client = clientMap.get(issuer);
	if (!client) {
		throw new Error(`Unknown OIDC issuer: ${issuer}`);
	}
	return client;
}

export type Issuer = string;
