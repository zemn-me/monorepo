load("//:rules.bzl", "ts_project")

ts_project(
    name = "TitlePage",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    project_deps = [
        "//project/zemn.me/elements/TimeEye:TimeEye",
    ],
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
