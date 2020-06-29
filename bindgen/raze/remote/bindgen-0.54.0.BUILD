"""
cargo-raze crate build file.

DO NOT EDIT! Replaced on runs of cargo-raze
"""
package(default_visibility = [
  # Public for visibility by "@raze__crate__version//" targets.
  #
  # Prefer access through "//bindgen/raze", which limits external
  # visibility to explicit Cargo.toml dependencies.
  "//visibility:public",
])

licenses([
  "notice", # BSD-3-Clause from expression "BSD-3-Clause"
])

load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_library",
    "rust_binary",
    "rust_test",
)

load(
    "@io_bazel_rules_rust//cargo:cargo_build_script.bzl",
    "cargo_build_script",
)

cargo_build_script(
    name = "bindgen_build_script",
    srcs = glob(["**/*.rs"]),
    crate_root = "build.rs",
    edition = "2018",
    deps = [
    ],
    rustc_flags = [
        "--cap-lints=allow",
    ],
    crate_features = [
      "clap",
      "default",
      "env_logger",
      "log",
      "logging",
      "runtime",
      "which",
      "which-rustfmt",
    ],
    data = glob(["**"]),
    version = "0.54.0",
    visibility = ["//visibility:private"],
)

rust_binary(
    # Prefix bin name to disambiguate from (probable) collision with lib name
    # N.B.: The exact form of this is subject to change.
    name = "cargo_bin_bindgen",
    deps = [
        # Binaries get an implicit dependency on their crate's lib
        ":bindgen",
        ":bindgen_build_script",
        "@raze__bitflags__1_2_1//:bitflags",
        "@raze__cexpr__0_4_0//:cexpr",
        "@raze__cfg_if__0_1_10//:cfg_if",
        "@raze__clang_sys__0_29_3//:clang_sys",
        "@raze__clap__2_33_1//:clap",
        "@raze__env_logger__0_7_1//:env_logger",
        "@raze__lazy_static__1_4_0//:lazy_static",
        "@raze__lazycell__1_2_1//:lazycell",
        "@raze__log__0_4_8//:log",
        "@raze__peeking_take_while__0_1_2//:peeking_take_while",
        "@raze__proc_macro2__1_0_18//:proc_macro2",
        "@raze__quote__1_0_7//:quote",
        "@raze__regex__1_3_9//:regex",
        "@raze__rustc_hash__1_1_0//:rustc_hash",
        "@raze__shlex__0_1_1//:shlex",
        "@raze__which__3_1_1//:which",
    ],
    srcs = glob(["**/*.rs"]),
    crate_root = "src/main.rs",
    edition = "2018",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.54.0",
    crate_features = [
        "clap",
        "default",
        "env_logger",
        "log",
        "logging",
        "runtime",
        "which",
        "which-rustfmt",
    ],
)


rust_library(
    name = "bindgen",
    crate_type = "lib",
    deps = [
        ":bindgen_build_script",
        "@raze__bitflags__1_2_1//:bitflags",
        "@raze__cexpr__0_4_0//:cexpr",
        "@raze__cfg_if__0_1_10//:cfg_if",
        "@raze__clang_sys__0_29_3//:clang_sys",
        "@raze__clap__2_33_1//:clap",
        "@raze__env_logger__0_7_1//:env_logger",
        "@raze__lazy_static__1_4_0//:lazy_static",
        "@raze__lazycell__1_2_1//:lazycell",
        "@raze__log__0_4_8//:log",
        "@raze__peeking_take_while__0_1_2//:peeking_take_while",
        "@raze__proc_macro2__1_0_18//:proc_macro2",
        "@raze__quote__1_0_7//:quote",
        "@raze__regex__1_3_9//:regex",
        "@raze__rustc_hash__1_1_0//:rustc_hash",
        "@raze__shlex__0_1_1//:shlex",
        "@raze__which__3_1_1//:which",
    ],
    srcs = glob(["**/*.rs"]),
    crate_root = "src/lib.rs",
    edition = "2018",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.54.0",
    crate_features = [
        "clap",
        "default",
        "env_logger",
        "log",
        "logging",
        "runtime",
        "which",
        "which-rustfmt",
    ],
)

