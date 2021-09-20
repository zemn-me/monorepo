load("@npm//@bazel/typescript:index.bzl", "ts_project")

exports_files(
    ["jest.ts.config.js"],
    visibility = ["//visibility:public"],
)

ts_project(
    name = "jest_reporter_js",
    srcs = ["jest_reporter.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig",
    visibility = ["//visibility:public"],
    deps = [
        "@npm//@types/node",
    ],
)
