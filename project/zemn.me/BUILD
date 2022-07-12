load("//ts:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")
load("//css:rules.bzl", "css_library")

ts_project(
    name = "ts",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]) + [":css"],
    deps = [
        "//project/zemn.me/elements/DarkModeSwitcher",
        "//project/zemn.me/elements/NavBar",
        "//project/zemn.me/elements/TitlePage",
        "//project/zemn.me/pages",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom",
    ],
)

web_app(
    name = "zemn.me",
    entry_points = ["index.tsx"],
    esbuild_deps = [":ts"],
    deps = ["index.html"],
)

css_library(
    name = "css",
    srcs = ["//project/zemn.me:root.module.css"],
)
