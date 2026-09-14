# Authentication

- MCP tokens are resource-bound credentials backed by revocable OAuth grants. Website identity tokens authenticate the consent decision, never MCP requests.
- OAuth records use conditional DynamoDB writes; process-local locks cannot enforce single-use codes or refresh rotation across Lambda instances. Check expiry in code independently of TTL cleanup.
- MCP and OAuth HTTP routes belong in `../spec.yaml` and the generated strict server. Use the MCP response visitor for SDK dispatch; keep transport middleware free of endpoint dispatch.
