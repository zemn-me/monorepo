load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "ZemnmezLogo",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
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
)
