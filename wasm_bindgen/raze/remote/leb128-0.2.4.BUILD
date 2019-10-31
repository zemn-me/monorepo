"""
cargo-raze crate build file.

DO NOT EDIT! Replaced on runs of cargo-raze
"""
package(default_visibility = [
  # Public for visibility by "@raze__crate__version//" targets.
  #
  # Prefer access through "//wasm_bindgen/raze", which limits external
  # visibility to explicit Cargo.toml dependencies.
  "//visibility:public",
])

licenses([
  "notice", # "Apache-2.0,MIT"
])

load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_library",
    "rust_binary",
    "rust_test",
)


# Unsupported target "bench" with type "bench" omitted

rust_library(
    name = "leb128",
    crate_root = "src/lib.rs",
    crate_type = "lib",
    edition = "2015",
    srcs = glob(["**/*.rs"]),
    deps = [
    ],
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.2.4",
    crate_features = [
    ],
)

rust_binary(
    # Prefix bin name to disambiguate from (probable) collision with lib name
    # N.B.: The exact form of this is subject to change.
    name = "cargo_bin_leb128_repl",
    crate_root = "src/bin/leb128-repl.rs",
    edition = "2015",
    srcs = glob(["**/*.rs"]),
    deps = [
        # Binaries get an implicit dependency on their crate's lib
        ":leb128",
    ],
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "0.2.4",
    crate_features = [
    ],
)

# Unsupported target "quickchecks" with type "test" omitted
