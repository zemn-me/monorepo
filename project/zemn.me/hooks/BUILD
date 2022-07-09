load("//:rules.bzl", "ts_project")

ts_project(
    name = "hooks",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    project_deps = [
        "//ts/iter:iter",
    ],
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
