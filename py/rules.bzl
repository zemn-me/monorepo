"rules for using python in the monorepo."

load("@rules_python//python:defs.bzl", _py_binary = "py_binary", _py_library = "py_library", _py_test = "py_test")
load("//bzl/lint:linters.bzl", "ruff_test")

def py_test(name, **kwargs):
    _py_test(
        name = name,
        **kwargs
    )

    ruff_test(
        name = name + "_ruff_lint",
        srcs = [name],
    )

def py_library(name, **kwargs):
    _py_library(
        name = name,
        **kwargs
    )

    ruff_test(
        name = name + "_ruff_lint",
        srcs = [name],
    )

def py_binary(name, **kwargs):
    _py_binary(
        name = name,
        **kwargs
    )

    ruff_test(
        name = name + "_ruff_lint",
        srcs = [name],
    )
