load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "react",
    srcs = [
        "index.tsx",
        "table.module.css",
        "table.tsx",
    ],
    deps = [
        "//project/cultist/state",
        "@npm//@types/d3-scale",
        "@npm//@types/react",
        "@npm//d3-scale",
        "@npm//react",
    ],
)
