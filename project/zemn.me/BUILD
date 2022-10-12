load("//ts:rules.bzl", "ts_project")
load("//ts/next.js:rules.bzl", "next_project")
load("//css:rules.bzl", "css_library")

css_library(
    name = "css",
    srcs = glob([
        "**/*.css"
    ])
)

ts_project(
    name = "ts",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
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
        ":css"
    ]
)

next_project(
    name = "zemn.me",
    srcs = [ ":ts" ]
)



"""
Currently broken / disabled due to lack of CSS modules support
web_app(
    name = "zemn.me",
    entry_points = ["index.tsx"],
    esbuild_deps = [":ts"],
    deps = ["index.html"],
)

"""
