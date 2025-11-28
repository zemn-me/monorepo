import * as z from "zod/v4-mini";

import { isDefined } from "#root/ts/guard.js";


export const OAuthError = z.object({
	error: z.enum([
    "invalid_request", "invalid_client", "invalid_grant", "unauthorized_client", "unsupported_grant_type", "invalid_scope"
	]),
    error_description: z.optional(z.string()),
    error_uri: z.optional(z.string()),
})

export type OAuthError = z.infer<typeof OAuthError>;

export class EOAuthError extends Error {
	constructor(public readonly data: OAuthError) {
		super([
			data.error,
			data.error_description,
			data.error_uri
		].filter(isDefined).join(": "))
	}
}
