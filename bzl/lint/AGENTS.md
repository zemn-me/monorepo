# bzl/lint

JS-backed lint actions that pass execroot source paths should set
`BAZEL_BINDIR="."`. Use `ctx.bin_dir.path` only if the action also copies its
sources and configs into `bazel-out/bin`.
