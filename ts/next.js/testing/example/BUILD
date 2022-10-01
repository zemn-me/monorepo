load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("//ts/next.js:rules.bzl", "next_project")

ts_project(
    name = "ts_sources",
    data = ["@npm//next/bin:next"],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@types/node",
        "@npm//react",
        "@npm//react-dom",
        "@npm//@types/react",
        "//ts/math",
    ]
)

next_project(
    name = "example",
    distDir = "build",
    srcs = [ ":ts_sources" ]
)