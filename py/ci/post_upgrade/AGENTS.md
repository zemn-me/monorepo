# post_upgrade notes

Nested `.fix` targets can copy read-only Bazel outputs into the checkout; call the underlying fixer directly when post_upgrade rewrites workspace files.

Run `sync_go_versions()` both before and after `go_mod_tidy()`: first to update Bazel's Go SDK before Go runs, then to catch any go.mod directive changes from tidy.

`sh/postUpgrade.sh` refreshes checksums for changed archive URLs before starting Bazel. Keep this bootstrap stdlib-only; otherwise a stale checksum can prevent its own repair tool from loading. For an already committed update, pass `--baseline-ref` to `integrity.py` with the revision before that update.
