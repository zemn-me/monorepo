load("//ts:rules.bzl", "ts_project", "ts_sources", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    deps = [
        "//ts/iter:srcs",
        "@npm//@types/react",
        "@npm//react",
    ],
)

ts_project(
    name = "iter",
    srcs = [":srcs"],
)

ts_test(
    name = "test",
    srcs = [":iter"],
)
