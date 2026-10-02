# Bowery Bugle API

`api/spec.yaml` is the API contract. Bazel generates the strict Go server and
TypeScript client types; update the spec rather than adding handwritten routes
or network types. Keep HTTP framing/CORS in `server/protocol_http.go` and
`Server.Handler`, and use the generated interface for endpoint behavior.
