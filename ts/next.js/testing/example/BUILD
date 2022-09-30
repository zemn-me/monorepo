load("//ts:rules.bzl", "nodejs_binary", "jest_test", "ts_project")   
load("@bazel_skylib//rules:run_binary.bzl", "run_binary")


ts_project(
    name = "ts_sources",
    data = [ "@npm//next/bin:next" ],
    deps = [ "@npm//@bazel/runfiles", "@npm//@types/node" ]
)

run_binary(
    name = "build",
    tool = ":next_bin",
    outs = [ ".next" ]
)


nodejs_binary(
    name = "next_bin",
    entry_point = ":next_entry.js",
    data = [":ts_sources", "//:tsconfig"],
)
