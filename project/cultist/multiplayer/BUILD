load("//ts:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")

ts_project(
    name = "index",
    srcs = [
        "index.tsx",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//project/cultist/multiplayer/pages",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

web_app(
    name = "multiplayer",
    entry_points = ["//project/cultist/multiplayer:index.tsx"],
    project_esbuild_deps = [":index"],
    visibility = ["//project/cultist/multiplayer:__subpackages__"],
    deps = [":index.html"],
)
