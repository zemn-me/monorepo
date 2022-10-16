load("//ts:rules.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "copy_to_bin")


copy_to_bin(
    name = "css",
    srcs = glob([ "**/*.css" ])
)

ts_project(
    name = "ZemnmezLogo",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "//:base_defs",
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
    data = [
         ":css"
    ]
)
