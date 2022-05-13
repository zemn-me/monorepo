sh_binary(
    name = "affected_files",
    srcs = ["run_affected_tests.sh"],
)

sh_binary(
    name = "fix",
    srcs = ["fix.sh"],
    data = [
        "//:buildifier",
        "//css/lint",
        "@go_sdk//:bin/gofmt",
        "@npm//eslint/bin:eslint",
    ],
    env = {
        "FIX_CSS": "$(rootpath //css/lint)",
        "FIX_BAZEL": "$(rootpath //:buildifier)",
        "FIX_GO": "$(rootpath @go_sdk//:bin/gofmt)",
        "FIX_JS": "$(location @npm//eslint/bin:eslint)",
    },
    visibility = ["//:__subpackages__"],
    deps = [
        "@bazel_tools//tools/bash/runfiles",
    ],
)
