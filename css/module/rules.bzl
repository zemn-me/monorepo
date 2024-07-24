"rules for css modules."

load("//css:rules.bzl", "css_lint")

def css_module(name, srcs = []):
    native.filegroup(
        name = name,
        srcs = srcs,
    )

    css_lint(
        name = name + "_lint",
        srcs = srcs,
    )
