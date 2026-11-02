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
  shared helpers in the test-only `browserhelpers` package.
- The local OIDC provider advertises Google contact scopes for auth-flow
  compatibility, but its access token is not a Google API token. Gate
  browser Google API calls on the real Google issuer.

- `:integration_test` collects the surface-specific browser targets. Each has
  its own production bundle and service stack. The frontend builds after
  `rules_itest` assigns the API/OIDC ports; keep it on the deployment build
  pipeline, not Vite dev.

- Each browser surface has its own Go package. Gazelle generates its
  `browser_test` rule through `gazelle:map_kind`; the macro provides the
  service harness. Add tests to the matching package and let Gazelle manage
  sources and dependencies.
