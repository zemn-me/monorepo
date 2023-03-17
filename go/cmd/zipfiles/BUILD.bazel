load("//:rules.bzl", "go_binary")

go_binary(
    name = "zipfiles",
    srcs = glob(["*.go"]),
    visibility = ["//visibility:public"],
    deps = [
        "//go/archive/zip/ziputil",
        "//go/flag/flagutil",
    ],
)
