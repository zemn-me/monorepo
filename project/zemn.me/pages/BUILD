load("//:rules.bzl", "ts_project")

ts_project(
    name = "pages",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    project_deps = [
        "//project/zemn.me/pages/art:art",
    ],
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
