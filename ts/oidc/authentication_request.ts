import {
  enum as zenum,
  number,
  object,
  optional,
  output,
  string,
} from "zod/v4-mini";

/**
 * OpenID Connect Authentication Request
 *
 * Parameters sent by the Relying Party (Client) to the
 * Authorization Server (OpenID Provider) to initiate authentication.
 * Based on OpenID Connect Core 1.0 §3.1.2.1.
 */
export const OIDCAuthenticationRequest = object({
  /** Space-delimited list of scopes. Must include "openid". */
  scope: string(),

  /**
   * Determines the flow and what tokens are returned.
   * Examples: "code", "id_token", "id_token token", "code id_token".
   */
  response_type: string(),

  /** Client identifier issued during registration. */
  client_id: string(),

  /** Redirection URI registered with the Authorization Server. */
  redirect_uri: string(),

  /** Opaque value for maintaining state between request and callback. */
  state: optional(string()),

  /** Mechanism for returning parameters ("query", "fragment", "form_post"). */
  response_mode: optional(string()),

  /** String to bind a client session to an ID Token and mitigate replay. */
  nonce: optional(string()),

  /** How the OP should display the authentication UI. */
  display: optional(zenum(["page", "popup", "touch", "wap"])),

  /**
   * Whether the OP should prompt for reauthentication or consent.
   * Values: "none", "login", "consent", "select_account".
   */
  prompt: optional(
    zenum(["none", "login", "consent", "select_account"])
  ),

  /** Max acceptable age (in seconds) since last active authentication. */
  max_age: optional(string()),

  /** End-User’s preferred UI languages, as space-separated BCP47 tags. */
  ui_locales: optional(string()),

  /** Preferred languages for returned Claims, as space-separated BCP47 tags. */
  claims_locales: optional(string()),

  /** Previously issued ID Token to hint about the End-User’s session. */
  id_token_hint: optional(string()),

  /** Hint to the OP about the End-User identifier (e.g. email, phone, username). */
  login_hint: optional(string()),

  /** Requested Authentication Context Class Reference values. */
  acr_values: optional(string()),

  /** JSON-encoded request for specific claims to be returned. */
  claims: optional(string()),

  /** JSON-encoded client metadata (used mainly with Self-Issued OPs). */
  registration: optional(string()),

  /** Request Object as a JWT, passed by value. */
  request: optional(string()),

  /** URI pointing to a Request Object JWT, passed by reference. */
  request_uri: optional(string()),
});

/**
 * OpenID Connect Authentication Request
 *
 * Parameters sent by the Relying Party (Client) to the
 * Authorization Server (OpenID Provider) to initiate authentication.
 * Based on OpenID Connect Core 1.0 §3.1.2.1.
 */
export type OIDCAuthenticationRequest = output<
  typeof OIDCAuthenticationRequest
>;
