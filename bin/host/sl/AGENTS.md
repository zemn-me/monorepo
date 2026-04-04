# Sapling build notes

- The Linux source build needs Yarn v1 for `addons`; use the Bazel-generated `@npm//:yarn/package_json.bzl` binary target rather than host `corepack` or `pnpm`.
- When a Bazel `js_binary` is invoked from the Linux `rules_foreign_cc` build as a plain tool, export `BAZEL_BINDIR=.` so the wrapper stays in the unpacked source tree; pointing it at Bazel's bin dir makes Yarn resolve the monorepo's root package set instead of Sapling's addon tree.
- Keep the Sapling and OpenSSL `http_archive` checksums inline in `MODULE.bazel` with `# auto-integrity`; Renovate plus `./sh/postUpgrade.sh` refreshes them automatically, and moving them into standalone vars breaks that flow.
- The Linux Bazel source build must export `SAPLING_VERSION` from `MODULE.bazel`; otherwise upstream `setup.py` falls back to an internal default and `sl --version` reports the wrong release.
