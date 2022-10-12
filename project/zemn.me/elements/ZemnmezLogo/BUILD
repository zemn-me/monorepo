load("//ts:rules.bzl", "ts_project")
load("//css:rules.bzl", "css_library")
load("@build_bazel_rules_nodejs//:index.bzl", "js_library", "copy_to_bin")


css_library(
    name = "css",
    srcs = glob([
        "**/*.css"
    ])
)

js_library(
    name = "css2",
    srcs = glob([
        "**/*.css"
    ])
)

copy_to_bin(
    name = "css3",
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
        ":css",
    ],
    data = [
        ":css2", ":css3"
    ]
)
