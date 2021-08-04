load("@npm//@bazel/typescript:index.bzl", "ts_project")

exports_files(["jest.ts.config.js"], visibility = ["//visibility:public"])

ts_project(
    name = "jest_reporter_js",
    srcs = [ "jest_reporter.ts" ],
    tsconfig="//:tsconfig",
    deps=[
        "@npm//@types/node"
    ],
    visibility = ["//visibility:public"]
)