# post_upgrade notes

Nested `.fix` targets can copy read-only Bazel outputs into the checkout; call the underlying fixer directly when post_upgrade rewrites workspace files.
