load("//ts/react:rules.bzl", "react_project", "react_test")

package(default_visibility = ["//:__subpackages__"])

react_project(
    name = "svg",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//ts/math",
    ]
)

react_test(
    name = "test",
    srcs = [":svg"],
)
