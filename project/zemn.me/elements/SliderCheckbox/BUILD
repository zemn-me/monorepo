load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")

ts_project(
    name = "SliderCheckbox",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "//project/zemn.me/elements/ZemnmezLogo",
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
