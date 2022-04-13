load("//ts/react:rules.bzl", "react_project", "react_test")

package(default_visibility = ["//:__subpackages__"])

react_project(
    name = "link",
    deps = [
        "//ts/url",
    ],
)

react_test(
    name = "test",
    srcs = [":link"],
)
