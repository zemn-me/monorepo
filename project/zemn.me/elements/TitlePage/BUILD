load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "TitlePage",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "//project/zemn.me/elements/TimeEye",
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
