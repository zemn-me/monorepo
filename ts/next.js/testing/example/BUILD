load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("@bazel_skylib//rules:run_binary.bzl", "run_binary")

ts_project(
    name = "ts_sources",
    data = ["@npm//next/bin:next"],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@types/node",
    ],
)

run_binary(
    name = "build",
    outs = [".next"],
    tool = ":next_bin",
)

nodejs_binary(
    name = "next_bin",
    data = [
        ":ts_sources",
        "//:tsconfig",
    ],
    entry_point = ":next_entry.js",
)
