load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "link",
    deps = [
        "//ts/url",
        "@npm//react-dom",
        "@npm//react-dom/test-utils",
    ],
)

ts_test(
    name = "test",
    srcs = [":link"],
)
