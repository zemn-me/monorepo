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
    env = {
        "FIX_BAZEL": "$(execpath //:buildifier)",
        "FIX_GO": "$(execpath @go_sdk//:bin/gofmt)",
        "FIX_JS": "$(execpath @npm//eslint/bin:eslint)"
    },
    srcs = [ "fix.sh" ]
)
