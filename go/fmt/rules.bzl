"Test formatting of Go code."

load("@aspect_rules_lint//format:defs.bzl", "format_test")

def test_go_fmt(srcs = [], **kwargs):
    format_test(
        srcs = srcs,
        go = "//bin/host/gofmt",
        **kwargs
    )
