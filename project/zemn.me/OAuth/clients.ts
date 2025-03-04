import { z } from "zod";

export interface Client {
	clientId: string
	issuer: Issuer
	name: string
}

export const clients = [
	{
		issuer: "https://accounts.google.com",
		clientId: `845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com`,
		name: "Google",
	}
] as const satisfies Client[];

export const Issuer = z.enum([
	"https://accounts.google.com"
]);

export type Issuer = z.TypeOf<typeof Issuer>
