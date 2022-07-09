load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")

ts_project(
    name = "pages",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "//project/zemn.me/pages/art",
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
