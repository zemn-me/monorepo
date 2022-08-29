load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = [
    ":__subpackages__",
    "//ts/cmd/do-sync:__subpackages__",
])

ts_project(
    name = "project",
    srcs = glob(["**/*.ts"]),
    deps = [
        "//ts/do-sync:lib",
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
