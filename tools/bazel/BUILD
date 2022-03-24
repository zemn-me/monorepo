sh_binary(
    name = "affected_files",
    srcs = [ "run_affected_tests.sh" ]
)


sh_binary(
    name = "fix",
    data = [
        "//:buildifier",
        "@go_sdk//:bin/gofmt",
        "@npm//eslint/bin:eslint"

    ],
    deps = [
"@bazel_tools//tools/bash/runfiles"
    ],
    env = {
        "FIX_BAZEL": "$(execpath //:buildifier)",
        "FIX_GO": "$(rootpath @go_sdk//:bin/gofmt)",
        "FIX_JS": "$(rootpath @npm//eslint/bin:eslint)"
    },
    srcs = [ "fix.sh" ]
)
