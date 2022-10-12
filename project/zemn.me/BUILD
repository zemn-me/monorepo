load("//ts:rules.bzl", "ts_project")
load("//ts/next.js:rules.bzl", "next_project")
load("//css:rules.bzl", "css_library")
load("@build_bazel_rules_nodejs//:index.bzl", "copy_to_bin")

copy_to_bin(
    name = "css",
    srcs = [ "root.module.css" ]
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
    ],
    data = [ ":css" ]
)

next_project(
    name = "zemn.me",
    srcs = [ ":ts"]
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
