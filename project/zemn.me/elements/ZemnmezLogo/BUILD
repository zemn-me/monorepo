load("//ts:rules.bzl", "ts_project")
load("//css:rules.bzl", "css_library")

css_library(
    name = "css",
    srcs = glob([
        "**/*.css"
    ])
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
        ":css"
    ],
)
