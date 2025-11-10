# Testing guidelines

Integration tests in this directory should mimic real user behaviour: drive the UI through Selenium (clicks, form fills, waits) and observe UI state. Do not set application state by writing directly to storage, dispatching synthetic events, or mutating network responses. If the test needs an auth token, obtain it via the same flow the user experiences (e.g. through the OIDC popup) and only read data that the app itself persisted.

- Group Selenium tests by surface area (e.g. `/admin`, `/grievanceportal`) instead of lumping them into a single file. Shared helpers can live alongside the tests in `*_helpers_test.go`.


## Interacting with the UI

Rather than injecting special classes or IDs, add information that would
be useful to a screenreader (i.e. ARIA annotations) and select and navigate
elements by that means.

## Extensions to global objects

Do not attempt to use global objects for testing or injecting content into
tests. You may use `window`, or `globalThis` for debugging, but do not keep
these in any live test or production code.
