load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "DarkModeSwitcher",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    project_deps = [
        "//project/zemn.me/elements/SliderCheckbox:SliderCheckbox",
    ],
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)
