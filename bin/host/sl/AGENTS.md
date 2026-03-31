# Sapling build notes

- The Linux source build needs Yarn v1 for `addons`; use the Bazel-generated `@npm//:yarn/package_json.bzl` binary target rather than host `corepack` or `pnpm`.
