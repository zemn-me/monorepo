load("@io_bazel_rules_go//go:def.bzl", "go_test")
load("@rules_python//python:defs.bzl", "py_test")
load("//tools/jest:jest.bzl", "jest_test")
load("@npm//@bazel/typescript:index.bzl", "ts_project")

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
    declaration = True,
    preserve_jsx = False,
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/node",
    ],
)

jest_test(
    name = "typescript_basic_test",
    srcs = ["typescript_basic_test.js"],
)
