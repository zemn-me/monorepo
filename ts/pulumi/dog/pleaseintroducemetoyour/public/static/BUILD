
load("//ts/next.js:rules.bzl", "next_project")
load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "ts",
    deps = [
        "@npm//next",
        "@npm//react",
        "@npm//@types/react"
    ]
)

next_project(
    name = "static",
    srcs = [ ":ts" ]
)