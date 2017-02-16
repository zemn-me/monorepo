package(default_visibility = ["//visibility:private"])

load("@io_bazel_skydoc//skylark:skylark.bzl", "skylark_doc")

skylark_doc(
    name = "rust-docs",
    srcs = ["@io_bazel_rules_rust//rust:rust.bzl"],
    format = "html",
    site_root = "https://bazelbuild.github.io/rules_rust",
)
