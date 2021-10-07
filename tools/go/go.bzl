
def test_go_fmt(srcs = [], deps = [], **kwargs):
    native.sh_test(
        env = {
            "GOFMT": "$(rootpath @go_sdk//:bin/gofmt)"
        },
        deps = deps,
        srcs = [ "//tools/go:test_fmt.sh" ],
        data = [ "@go_sdk//:bin/gofmt" ] + srcs,
        args = [ "$(rootpath %s)" % x for x in srcs ],
        **kwargs
    )
