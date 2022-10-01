load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("@bazel_skylib//rules:run_binary.bzl", "run_binary")
load("@build_bazel_rules_nodejs//:index.bzl", "copy_to_bin")

ts_project(
    name = "ts_sources",
    data = ["@npm//next/bin:next"],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@types/node",
        "@npm//react",
        "@npm//react-dom"

    ],
)

run_binary(
    name = "build",
    outs = ["build"],
    tool = ":next_bin",
    srcs = [ ":ts_sources" ],
    env = {
        "OUT": "$(location build)"
    }
)

nodejs_binary(
    name = "next_bin",
    data = [
        ":ts_sources",
        "//:tsconfig",
        "@npm//react",
        "@npm//next/bin:next"
    ],
    entry_point = ":next_entry.js",
    env = {
        "BAZEL_BINDIR": "$(BINDIR)"
    }
)