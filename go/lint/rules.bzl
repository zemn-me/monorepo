def go_lint(srcs = [], deps = [], **kwargs):
    native.sh_test(
        env = {
            "GOFMT": "$(rootpath @go_sdk//:bin/gofmt)",
        },
        deps = deps,
        srcs = ["//go/lint:test_fmt.sh"],
        data = ["@go_sdk//:bin/gofmt"] + srcs,
        args = ["$(rootpath %s)" % x for x in srcs],
        **kwargs
    )
