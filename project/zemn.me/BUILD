load("//:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")
load("//css:rules.bzl", "css_library")

ts_project(
    name = "ts",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]) + [ ":css" ],
    project_deps = [
        "//project/zemn.me/pages:pages",
        "//project/zemn.me/elements/NavBar:NavBar",
        "//project/zemn.me/elements/TitlePage:TitlePage",
        "//project/zemn.me/elements/DarkModeSwitcher:DarkModeSwitcher",
    ],
    deps = [
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
        "@npm//react-router-dom"
    ],
)

web_app(
    name = "zemn.me",
    entry_points = ["index.tsx"],
    project_esbuild_deps = [":ts"],
    deps = ["index.html"],
)


css_library(
    name = "css",
    srcs = [ "//project/zemn.me:root.module.css" ]
)