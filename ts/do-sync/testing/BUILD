load("//ts:rules.bzl", "jest_test", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "js_library")

package(default_visibility = [
    ":__subpackages__",
    "//ts/cmd/svgshot:__subpackages__",
])

ts_project(
    name = "project",
    srcs = glob(["**/*.ts"]),
    deps = [
        "//ts/do-sync",
        "@npm//@types/jest",
        "@npm//@types/sharp",
        "@npm//sharp",
    ],
)

jest_test(
    name = "tests",
    srcs = ["doSync_test.js"],
    deps = [":project"],
)
