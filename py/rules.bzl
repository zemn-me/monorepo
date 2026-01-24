"rules for using python in the monorepo."

load("@aspect_rules_py//py:defs.bzl", _py_binary = "py_binary", _py_library = "py_library", _py_test = "py_test")
load("//bzl/lint:linters.bzl", "ruff_test")

_RUNFILES_LIB = "@rules_shell//shell/runfiles:runfiles"

def py_test(name, **kwargs):
    data = list(kwargs.pop("data", []))
    if _RUNFILES_LIB not in data:
        data.append(_RUNFILES_LIB)

    _py_test(
        name = name,
        data = data,
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
    data = list(kwargs.pop("data", []))
    if _RUNFILES_LIB not in data:
        data.append(_RUNFILES_LIB)

    _py_binary(
        name = name,
        data = data,
        **kwargs
    )

    ruff_test(
        name = name + "_ruff_lint",
        srcs = [name],
    )
