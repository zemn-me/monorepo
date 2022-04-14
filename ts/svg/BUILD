load("//ts/react:rules.bzl", "react_project", "react_test")

package(default_visibility = ["//:__subpackages__"])

react_project(
    name = "svg",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//ts",
        "//ts/math",
        "@npm//@types/d3-scale",
        "@npm//d3-scale",
    ],
)

react_test(
    name = "test",
    srcs = [":svg"],
)
