"Test formatting of Go code."

load("@aspect_rules_lint//format:defs.bzl", "format_test")

def test_go_fmt(srcs = [], size = "small", **kwargs):
    format_test(
        size = size,
        srcs = srcs,
        go = "//bin/host/gofmt",
        **kwargs
    )
