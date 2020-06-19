package(default_visibility = ["//visibility:public"])

load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_binary",
)

rust_binary(
    name = "hello_sys",
    srcs = ["src/main.rs"],
    edition = "2018",
    deps = ["@bzip2"],
)

sh_test(
    name = "test",
    srcs = ["test.sh"],
    args = ["$(location :hello_sys)"],
    data = [":hello_sys"],
)
