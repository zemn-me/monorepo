load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("@rules_python//python:defs.bzl", "py_test")

py_test(
    name = "test_parse_core",
    srcs = ["test_parse_core.py"],
    deps = ["//project/cultist/gen:core_py"],
)
