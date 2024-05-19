"formatting support."

load("@aspect_rules_lint//format:defs.bzl", _format_test = "format_test")

def format_test(name, srcs = None):
    _format_test(
        name = name,
        javascript = "//bzl/format:prettier",
        starlark = "//:buildifier",
        srcs = srcs,
    )
