load("//ts:rules.bzl", "ts_sources", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "srcs",
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "//ts/iter:srcs"
    ]
)

ts_project(
    name = "iter",
    srcs = [ ":srcs" ],
)

ts_test(
    name = "test",
    srcs = [ ":iter" ]
)


