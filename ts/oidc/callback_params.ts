import { literal, number, object, optional, string, union } from 'zod';

/**
 * @see https://openid.net/specs/openid-connect-core-1_0.html#ImplicitAuthResponse
 */
export const OIDCImplicitAuthResponse = object({
	access_token: optional(string()),
	token_type: literal("bearer"),
	id_token: optional(string()),
	expires_in: number(),
	state: optional(string()),
})

export const OIDCAuthErrorCode = union([
	literal("interaction_required"),
	literal("login_required"),
	literal("account_selection_required"),
	literal("consent_required"),
	literal("invalid_request_uri"),
	literal("invalid_request_object"),
	literal("request_not_supported"),
	literal("request_uri_not_supported"),
	literal("registration_not_supported"),
])

export const OIDCAuthErrorResponse = object({
	error: OIDCAuthErrorCode,
	error_description: optional(string()),
	state: optional(string()),
})

export const OIDCResoponse = union([
	OIDCAuthErrorResponse,
	OIDCImplicitAuthResponse
])
