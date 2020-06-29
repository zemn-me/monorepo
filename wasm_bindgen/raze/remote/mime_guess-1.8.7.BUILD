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
  "notice", # MIT from expression "MIT"
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
    name = "mime_guess_build_script",
    srcs = glob(["**/*.rs"]),
    crate_root = "build.rs",
    edition = "2015",
    deps = [
        "@raze__phf_codegen__0_7_24//:phf_codegen",
        "@raze__unicase__1_4_2//:unicase",
    ],
    rustc_flags = [
        "--cap-lints=allow",
    ],
    crate_features = [
    ],
    data = glob(["**"]),
    version = "1.8.7",
    visibility = ["//visibility:private"],
)


rust_library(
    name = "mime_guess",
    crate_type = "lib",
    deps = [
        ":mime_guess_build_script",
        "@raze__mime__0_2_6//:mime",
        "@raze__phf__0_7_24//:phf",
        "@raze__unicase__1_4_2//:unicase",
    ],
    srcs = glob(["**/*.rs"]),
    crate_root = "src/lib.rs",
    edition = "2015",
    rustc_flags = [
        "--cap-lints=allow",
    ],
    version = "1.8.7",
    crate_features = [
    ],
)

# Unsupported target "rev_map" with type "example" omitted
