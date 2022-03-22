
load("//:rules.bzl", "ts_project")

ts_project(
    name = "pages",
    srcs = glob(["*.ts", "*.tsx", "*.css"]),
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-router-dom",
        "@npm//react-dom",
    ],
    visibility = [ "//project/zemn.me:__subpackages__" ]
)

