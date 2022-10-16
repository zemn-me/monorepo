load("//ts/next.js:rules.bzl", "next_project")
load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//ts/pulumi/dog/pleaseintroducemetoyour/public:__pkg__"])

ts_project(
    name = "ts",
    deps = [
        "//ts/next.js",
        "@npm//@bazel/runfiles",
        "@npm//@types/react",
        "@npm//next",
        "@npm//react",
        "//git"
    ],
)

next_project(
    name = "static",
    srcs = [":ts"],
)
