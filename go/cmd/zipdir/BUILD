load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//:rules.bzl", "go_binary")

go_binary(
    name = "zipdir",
    srcs = glob(["*.go"]),
    visibility = ["//visibility:public"],
    deps = [
        "//go/archive/zip/ziputil",
        "//go/flag/flagutil",
    ],
)
