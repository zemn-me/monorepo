
load("//ts/next.js:rules.bzl", "next_project")
load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "ts",
)

next_project(
    name = "static",
    srcs = [ ":ts" ]
)