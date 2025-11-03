# Testing guidelines

Integration tests in this directory should mimic real user behaviour: drive the UI through Selenium (clicks, form fills, waits) and observe UI state. Do not set application state by writing directly to storage, dispatching synthetic events, or mutating network responses. If the test needs an auth token, obtain it via the same flow the user experiences (e.g. through the OIDC popup) and only read data that the app itself persisted.

- Group Selenium tests by surface area (e.g. `/admin`, `/grievanceportal`) instead of lumping them into a single file. Shared helpers can live alongside the tests in `*_helpers_test.go`.
