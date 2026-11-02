# bzl/lint

JS-backed lint actions that pass execroot source paths should set
`BAZEL_BINDIR="."`. Use `ctx.bin_dir.path` only if the action also copies its
sources and configs into `bazel-out/bin`.

In Biome shell tests, do not use `BIOME_BINARY` for a runfile path; Biome's own
Node wrapper treats it as the native binary override.
