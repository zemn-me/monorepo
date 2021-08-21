
load("@io_bazel_rules_go//go:def.bzl", "go_binary")

go_binary(
    name = "zipfiles",
    srcs = glob(["*.go"]),
    deps = [
        "//go/archive/zip/ziputil:ziputil",
        "//go/flag/flagutil:flagutil"
        ],
    visibility = ["//visibility:public"]
)