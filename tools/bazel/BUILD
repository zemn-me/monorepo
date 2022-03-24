sh_binary(
    name = "affected_files",
    srcs = ["run_affected_tests.sh"],
)

sh_binary(
    name = "fix",
    srcs = ["fix.sh"],
    data = [
        "//:buildifier",
        "@go_sdk//:bin/gofmt",
        "@npm//eslint/bin:eslint",
    ],
    env = {
        "FIX_BAZEL": "$(rootpath //:buildifier)",
        "FIX_GO": "$(rootpath @go_sdk//:bin/gofmt)",
        "FIX_JS": "$(rootpath @npm//eslint/bin:eslint)",
    },
    visibility = ["//:__subpackages__"],
    deps = [
        "@bazel_tools//tools/bash/runfiles",
    ],
)
