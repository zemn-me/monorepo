load("@rules_python//python:defs.bzl", "py_test")
load("//:rules.bzl", "go_test", "jest_test", "ts_project")

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
    composite = True,
    declaration = True,
    incremental = True,
    preserve_jsx = False,
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
