load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "next.js",
    deps = [
        "@npm//@types/node",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//next",
        "@npm//react",
        "@npm//react-dom",
    ],
)

exports_files(
    ["next.config.ts"],
    visibility = ["//visibility:public"],
)
