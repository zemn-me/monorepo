# Browser integration tests

- Drive the UI through Selenium and assert visible behaviour. Set up
  application state through user flows, including the OIDC popup for auth;
  do not seed storage, dispatch synthetic events, or mutate network
  responses. Read only data the app itself persisted.
- Select elements through accessible roles, names, and status indicators
  (`role`, `aria-label`, `aria-live`). When tests need observable state,
  expose it usefully in the UI rather than adding test-only attributes,
  classes, IDs, or globals. Assert that UI state instead of polling internal
  APIs or databases when the UI can expose it.
- Group tests by surface (for example, `/admin` or `/grievanceportal`), with
  shared helpers in `*_helpers_test.go`.
- The local OIDC provider advertises Google contact scopes for auth-flow
  compatibility, but its access token is not a Google API token. Gate
  browser Google API calls on the real Google issuer.
