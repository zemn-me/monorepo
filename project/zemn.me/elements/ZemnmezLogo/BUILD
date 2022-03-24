load("//:rules.bzl", "ts_project")

ts_project(
    name = "ZemnmezLogo",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
        "@npm//classnames",
    ],
)
