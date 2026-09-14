# Voice diary MCP

Add `https://api.zemn.me/journal/mcp` as a remote Streamable HTTP server and
choose OAuth. The client discovers registration and authorization endpoints,
opens zemn.me for sign-in and consent, and completes PKCE automatically. No
manual bearer token, client ID, or client secret is required.

The consent page shows the client name, client identifier, return address, and
`journal_read` permission. It reuses the website's existing Google sign-in and
zemn.me token exchange. Approval requires the journal owner's current account
permissions. Client names are self-declared; check the return address before
sharing private entries.

## OAuth protocol

- Protected resource metadata: `/.well-known/oauth-protected-resource/journal/mcp`
  (also available at `/.well-known/oauth-protected-resource`). The MCP bearer
  challenge points to it and requests `journal_read`.
- Authorization server metadata: `/.well-known/oauth-authorization-server`.
  The existing `/.well-known/openid-configuration` also advertises these
  endpoints, PKCE, and registration capabilities for clients using OIDC discovery.
- Dynamic registration: `POST /oauth2/register`, using RFC 7591 client metadata.
  Public clients use `token_endpoint_auth_method: none`. Request
  `authorization_code` and optionally `refresh_token` in `grant_types`.
- Client ID Metadata Documents: HTTPS client IDs with a path are resolved as
  metadata documents. Their `client_id` must match the URL exactly. Fetches are
  bounded, disallow redirects, and resolve and dial only public IP addresses.
  Metadata is fetched anew for authorization and held in the consent request.
- Authorization: `GET /oauth2/authorize`, with `response_type=code`, a registered
  `redirect_uri`, `scope=journal_read`, and mandatory S256 PKCE. Redirect URIs
  match exactly and must use HTTPS or HTTP loopback for local clients.
- Both authorization and token requests must include
  `resource=https://api.zemn.me/journal/mcp`.
- Token exchange and refresh: `POST /oauth2/mcp/token`, form encoded. Code
  redemption includes `client_id`, `redirect_uri`, `code`, and `code_verifier`.
  Refresh includes `client_id`, `refresh_token`, and `resource`.
- Revocation: `POST /oauth2/mcp/revoke`, form encoded with `client_id` and `token`.
  Revoking either token revokes its whole connection immediately.

Authorization requests expire after ten minutes; codes expire after one minute
and are single use. Access tokens last at most one hour, and renewable grants
last thirty days. Refresh tokens rotate on every use. Reusing an old signed
refresh token revokes the connection. Clients must serialize refresh requests
and store the replacement token. The user must authorize again after expiry or
revocation.

The existing `/oauth2/token` website token exchange remains unchanged. Its broad
website identity tokens are no longer accepted directly by MCP. MCP tokens are
bound to the MCP resource, the consenting account, and `journal_read`, and cannot
be used as website identity tokens or refresh tokens. Every MCP request verifies
the signature, issuer, audience, token purpose, expiry, active grant, current
account permission, and diary ownership.

OAuth routes are handled outside the OpenAPI JSON validator because they use
OAuth-specific request and response framing, as does the MCP transport. Consent
response schemas live in the OpenAPI spec for the generated frontend types.
The frontend consent page is `/journal/connect`; its origin comes from
`OAUTH_FRONTEND_ORIGIN` (defaults to `https://zemn.me`). OAuth state and registered
clients use `OAUTH_TABLE_NAME`. `ZEMN_API_ORIGIN` pins discovery, issuer, and resource URLs
to the deployed API origin, including staging. Pulumi provisions this table with TTL cleanup;
application code checks expiry independently and uses conditional DynamoDB
writes for code consumption and refresh rotation across Lambda instances.

## Tools

| Tool | Inputs | Result |
| --- | --- | --- |
| `search_journal` | Optional `query`, RFC3339 `start` (inclusive) and `end` (exclusive), `offset`, `limit` | Completed entries, newest first, with IDs, recording times, titles and excerpts. Text matching is a case-insensitive substring search. Empty query lists entries. |
| `get_journal_entry` | `id` from search | Full transcript segments and the entry summary, preserving citation references. |
| `list_journal_summaries` | Optional `period` (`day`, `week`, `month`, `year`, `journal`), `offset`, `limit` | Aggregate summaries, newest first, preserving citations. |

Pages default to 20 results and allow up to 50. Pass `next_offset` back as
`offset` to continue. Offset pagination reflects the current journal, so records
added or removed between requests can shift page boundaries. Audio URLs and
storage keys are not exposed. Search currently reads the owner's journal from
DynamoDB, including all DynamoDB pages, rather than using a separate search index.

The transport is stateless and returns JSON so it works behind the existing
buffered Lambda/API infrastructure. No MCP session ID grants access. Responses
are marked `private, no-store`; cross-origin browser requests are rejected.
