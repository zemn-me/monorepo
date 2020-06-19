load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_library",
)

rust_library(
    name = "bzip2",
    srcs = glob(["**/*.rs"]),
    crate_root = "src/lib.rs",
    crate_type = "lib",
    edition = "2015",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.3.3",
    visibility = ["//visibility:public"],
    deps = [
        "@bzip2_sys",
        "@libc",
    ],
)
