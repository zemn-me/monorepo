import {
  number,
  object,
  optional,
  output,
  string,
  union,
} from "zod/v4-mini";

/**
 * OpenID Connect Authentication Success Response
 *
 * Returned from the Authorization Endpoint when the request succeeds.
 * Depending on the flow:
 *  - Code Flow: contains `code` (and usually `state`).
 *  - Implicit Flow: contains `id_token`, and optionally `access_token`, `token_type`, `expires_in`.
 *  - Hybrid Flow: combinations of `code`, `id_token`, and optionally `access_token`.
 *
 * Spec: OIDC Core §3.1.2.5, §3.2.2.5, §3.3.2.5
 */
export const OIDCAuthenticationSuccessResponse = object({
  /** Authorization Code (Code / Hybrid flows). */
  code: optional(string()),

  /** ID Token (JWT) (Implicit / Hybrid flows). */
  id_token: optional(string()),

  /** Access Token (Implicit / Hybrid flows). */
  access_token: optional(string()),

  /** Token type for `access_token` (typically "Bearer"). */
  token_type: optional(string()),

  /** Lifetime in seconds of the `access_token`. */
  expires_in: optional(number()),

  /** Echo of request `state`, used for CSRF protection. */
  state: optional(string()),
});

/**
 * OpenID Connect Authentication Error Response
 *
 * Returned from the Authorization Endpoint when the request fails
 * (e.g. interaction required while `prompt=none`, invalid request, etc.).
 *
 * Spec: OIDC Core §3.1.2.6
 */
export const OIDCAuthenticationErrorResponse = object({
  /** Machine-readable error code (e.g. "invalid_request", "login_required"). */
  error: string(),

  /** Human-readable text description of the error. */
  error_description: optional(string()),

  /** URI with additional information about the error. */
  error_uri: optional(string()),

  /** Echo of request `state`, if it was supplied. */
  state: optional(string()),
});

export const OIDCAuthenticationResponse = union([
  OIDCAuthenticationSuccessResponse,
  OIDCAuthenticationErrorResponse,
]);

export type OIDCAuthenticationSuccessResponse = output<
  typeof OIDCAuthenticationSuccessResponse
>;
export type OIDCAuthenticationErrorResponse = output<
  typeof OIDCAuthenticationErrorResponse
>;
export type OIDCAuthenticationResponse = output<
  typeof OIDCAuthenticationResponse
>;
