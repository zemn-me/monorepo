
load("//:rules.bzl", "ts_project")

ts_project(
    name = "pages",
    srcs = glob(["*.ts", "*.tsx", "*.css"]),
    project_deps = [
        "//project/zemn.me/pages/art:art",
    ],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-router-dom",
        "@npm//react-dom",
    ],
    visibility = [ "//project/zemn.me:__subpackages__" ]
)

