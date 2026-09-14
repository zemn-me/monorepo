# Voice diary MCP

The API serves Streamable HTTP MCP at `https://api.zemn.me/journal/mcp`.
Use the existing zemn.me OAuth token exchange and send its returned token on
**every** MCP request:

```http
Authorization: Bearer <zemn.me token>
```

The token must be signed by this API, issued by its configured API origin,
intended for `zemn.me`, and unexpired. The server resolves `journal_read` using
the same account scopes as the diary and enforces the diary's owner restriction.
No additional scope or secret is needed. `journal_write` is not required because
all exposed tools are read-only.

This uses the existing `/oauth2/token` token-exchange flow. It does not add an
OAuth authorization-code/PKCE flow or dynamic client registration. Clients must
support configuring a bearer token; automatic browser sign-in requires a separate
authorization-code flow in the identity service.

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
