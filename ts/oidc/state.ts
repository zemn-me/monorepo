import b64 from 'base64-js';

const textEncoder = new TextEncoder();

const stateSignaturePrefix = "state|";

export interface StateTokenParams {
	readonly issuer: string;
	readonly clientId: string;
	readonly redirectUri: string;
}

const base64UrlEncode = (bytes: Uint8Array) =>
	b64.fromByteArray(bytes)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/u, "");

const base64UrlDecode = (value: string) => {
	const normalized = value
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
	return b64.toByteArray(normalized + padding);
};

const signatureMessage = (params: StateTokenParams) =>
	`${stateSignaturePrefix}${params.issuer}|${params.clientId}|${params.redirectUri}`;

async function signState(
	masterKey: CryptoKey,
	params: StateTokenParams
) {
	const message = textEncoder.encode(signatureMessage(params));
	return crypto.subtle.sign("HMAC", masterKey, message);
}

export async function stateStringForRequest(
	masterKey: CryptoKey,
	params: StateTokenParams
) {
	return base64UrlEncode(new Uint8Array(
		await signState(masterKey, params)
	));
}

export async function verifyStateSignature(
	masterKey: CryptoKey,
	params: StateTokenParams,
	state: string
) {
	const signature = base64UrlDecode(state);
	const message = textEncoder.encode(signatureMessage(params));

	return crypto.subtle.verify(
		"HMAC",
		masterKey,
		signature,
		message
	);
}
