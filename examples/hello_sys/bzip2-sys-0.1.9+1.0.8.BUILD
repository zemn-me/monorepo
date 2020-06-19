load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_library",
)
load(
    "@io_bazel_rules_rust//cargo:cargo_build_script.bzl",
    "cargo_build_script",
)

cargo_build_script(
    name = "bzip2_sys_build_script",
    srcs = glob(["**/*.rs"]),
    crate_root = "build.rs",
    data = glob(["**"]),
    edition = "2015",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.1.9+1.0.8",
    deps = [
        "@cc",
        "@pkg_config",
    ],
)

rust_library(
    name = "bzip2_sys",
    srcs = glob(["**/*.rs"]),
    crate_root = "lib.rs",
    crate_type = "lib",
    edition = "2015",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.1.9+1.0.8",
    visibility = ["//visibility:public"],
    deps = [
        ":bzip2_sys_build_script",
        "@libc",
    ],
)
