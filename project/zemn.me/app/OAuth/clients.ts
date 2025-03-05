import { z } from "zod";

export interface Client {
	clientId: string
	issuer: Issuer
	name: string
}

export const clients = new Set<Client>([
	{
		issuer: "https://accounts.google.com",
		clientId: `845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com`,
		name: "Google",
	}
]);

export function OAuthClientByIssuer(i: Issuer) {
	// below fails because we only have one issuer, requiring this
	// exemption!
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return [...clients].filter(v => v.issuer === i)[0]!;
}


export const Issuer = z.enum([
	"https://accounts.google.com"
]);

export type Issuer = z.TypeOf<typeof Issuer>
