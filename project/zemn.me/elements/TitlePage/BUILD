load("//:rules.bzl", "ts_project")

ts_project(
    name = "TitlePage",
    srcs = glob(["*.ts", "*.tsx", "*.css"]),
    project_deps = [
        "//project/zemn.me/elements/TimeEye:TimeEye"
    ],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-router-dom",
        "@npm//react-dom",
        "@npm//classnames"
    ],
    visibility = [ "//project/zemn.me:__subpackages__" ]
)

