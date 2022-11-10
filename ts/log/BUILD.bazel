load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "log",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/node",
    ],
)

jest_test(
    name = "test",
    srcs = [
        "log_test.js",
    ],
    deps = [":log"],
)
