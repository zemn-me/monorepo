load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//ts",
        "//ts/math",
        "@npm//@types/d3-scale",
        "@npm//@types/react",
        "@npm//d3-scale",
        "@npm//react",
    ],
)

ts_test(
    name = "test",
    srcs = [":svg"],
)
