load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//ts/next.js:rules.bzl", "next_project")

ts_project(
    name = "ts_sources",
    data = ["@npm//next/bin:next"],
    deps = [
        "//ts/math",
        "@npm//@bazel/runfiles",
        "@npm//@types/node",
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
    ],
)

next_project(
    name = "example",
    srcs = [":ts_sources"],
    distDir = "build",
)
