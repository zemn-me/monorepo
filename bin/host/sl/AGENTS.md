# Sapling build notes

- The Linux source build needs Yarn v1 for `addons`; use the Bazel-generated `@npm//:yarn/package_json.bzl` binary target rather than host `corepack` or `pnpm`.
- Keep the Sapling and OpenSSL `http_archive` checksums inline in `MODULE.bazel` with `# auto-integrity`; Renovate plus `./sh/postUpgrade.sh` refreshes them automatically, and moving them into standalone vars breaks that flow.
- The Linux Bazel source build must export `SAPLING_VERSION` from `MODULE.bazel`; otherwise upstream `setup.py` falls back to an internal default and `sl --version` reports the wrong release.
