load("//ts:rules.bzl", "jest_test", "nodejs_binary", "ts_project")
load("@bazel_skylib//rules:run_binary.bzl", "run_binary")
load("@build_bazel_rules_nodejs//:index.bzl", "copy_to_bin")
load("@npm//next:index.bzl", "next")

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

target = "node_modules/monorepo/" + package_name()

next(
    name = "build",
    data = [ ":ts_sources" ],
    link_workspace_root = True,
    args = [ "build", target],
    output_dir = True
)

next(
    name = "out",
    data = [ ":build", ":ts_sources" ],
    args = [ "export", target ],
    link_workspace_root = True,
    output_dir = True
)