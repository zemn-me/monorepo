load("@io_bazel_rules_go//go:def.bzl", _go_binary = "go_binary", _go_library = "go_library", _go_test = "go_test")
load("//go/fmt:rules.bzl", _test_go_fmt = "test_go_fmt")

def go_binary(name = None, embedsrcs = None, importpath = None, deps = [], **kwargs):
    _go_binary(
        name = name,
        deps = deps,
        importpath = importpath,
        embedsrcs = embedsrcs,
        **kwargs
    )

    _test_go_fmt(
        name = name + "_fmt",
    )

def go_test(name = None, importpath = None, deps = [], **kwargs):
    _go_test(
        name = name,
        deps = deps,
        importpath = importpath,
        **kwargs
    )

    _test_go_fmt(
        name = name + "_fmt",
        **kwargs
    )

def go_library(name = None, importpath = None, deps = [], **kwargs):
    _go_library(
        name = name,
        deps = deps,
        importpath = importpath,
        **kwargs
    )

    _test_go_fmt(
        name = name + "_fmt",
        **kwargs
    )
