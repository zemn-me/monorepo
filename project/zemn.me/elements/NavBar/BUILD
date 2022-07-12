load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "NavBar",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    visibility = ["//project/zemn.me:__subpackages__"],
    deps = [
        "//project/zemn.me/elements/ZemnmezLogo",
        "//project/zemn.me/hooks",
        "//ts",
        "@npm//@fortawesome/free-solid-svg-icons",
        "@npm//@fortawesome/react-fontawesome",
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
        "@npm//react-spring",
    ],
)
