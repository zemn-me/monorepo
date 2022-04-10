load("//go:rules.bzl", "go_test")
load("//ts:rules.bzl", "ts_test", "ts_project")
load("@rules_python//python:defs.bzl", "py_test")

go_test(
    name = "go_basic_test",
    srcs = ["go_basic_test.go"],
)

py_test(
    name = "python_basic_test",
    srcs = ["python_basic_test.py"],
)

ts_project(
    name = "typescript_basic_test_js",
    srcs = ["typescript_basic_test.ts"],
    deps = [
        "@npm//@types/node",
    ],
)

ts_test(
    name = "typescript_basic_test",
    srcs = ["typescript_basic_test.js"],
)
