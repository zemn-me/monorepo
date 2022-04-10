load("//lint:rules.bzl", "lint")
load("@io_bazel_rules_go//go:def.bzl", _go_binary = "go_binary", _go_library = "go_library", _go_test = "go_test")

def go_binary(name = None, srcs = None,  deps = [], **kwargs):
    _go_binary(
        name = name,
        deps = deps,
        **kwargs
    )

    lint(
        name = name,
        srcs = srcs
    )

def go_test(name = None, srcs = None, importpath = None,  deps = [], **kwargs):
    _go_test(
        name = name,
        deps = deps,
        importpath = importpath,
        **kwargs
    )


    lint(
        name = name,
        srcs = srcs
    )

def go_library(name = None, srcs = None, deps = [], **kwargs):
    _go_library(
        name = name,
        deps = deps,
        **kwargs
    )


    lint(
        name = name,
        srcs = srcs
    )
