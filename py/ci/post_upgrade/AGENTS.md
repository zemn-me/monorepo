# post_upgrade notes

Nested `.fix` targets can copy read-only Bazel outputs into the checkout; call the underlying fixer directly when post_upgrade rewrites workspace files.

Run `sync_go_versions()` both before and after `go_mod_tidy()`: first to update Bazel's Go SDK before Go runs, then to catch any go.mod directive changes from tidy.
