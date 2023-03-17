load("//ts:rules.bzl", "ts_project")
load("//ts/react/server:rules.bzl", "web_app")

ts_project(
    name = "index",
    srcs = [
        "index.tsx",
    ],
    resolve_json_module = True,
    deps = [
        "//project/cultist/multiplayer/pages",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

"""
Maybe one day when I get CSS working again, I can remove this.
web_app(
    name = "multiplayer",
    entry_points = ["//project/cultist/multiplayer:index.tsx"],
    esbuild_deps = [":index"],
    visibility = ["//project/cultist/multiplayer:__subpackages__"],
    deps = [":index.html"],
)


"""
