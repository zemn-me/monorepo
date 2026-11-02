# Authentication

- MCP tokens are resource-bound credentials backed by revocable OAuth grants. Website identity tokens authenticate the consent decision, never MCP requests.
- OAuth records use conditional DynamoDB writes; process-local locks cannot enforce single-use codes or refresh rotation across Lambda instances. Check expiry in code independently of TTL cleanup.
- MCP and OAuth HTTP routes belong in `../spec.yaml` and the generated strict server. Use the MCP response visitor for SDK dispatch; keep transport middleware free of endpoint dispatch.
- CIMD's plural `token_endpoint_auth_methods_supported` lists capabilities; negotiate against server support. The singular field remains binding for DCR, but is only a legacy preference when CIMD provides the plural field.

# Diary knowledge

- Use the published-generation readers for curated content. Wiki reads use separate page artifacts and validate only their cited primary evidence. Date corrections retain published knowledge; deleted or changed transcript evidence removes only the affected blocks across all read surfaces. Never invalidate the whole diary for a metadata edit or treat generated prose as primary citation evidence.
- Build the curator's output schema from `spec.yaml` and use it for import validation. Reflection of generated Go types loses enum constraints and can misrepresent UUIDs. The opt-in `TestJournalAgentsLiveSyntheticSchema` exercises hosted generation through publication using fake diary entries.
