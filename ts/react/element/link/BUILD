load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "link",
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
    ],
)

ts_test(
    name = "test",
    srcs = [":link"],
)
