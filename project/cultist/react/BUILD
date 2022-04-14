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
        "@npm//@types/react",
        "@npm//react",
    ],
)
