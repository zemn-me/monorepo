load("//ts:rules.bzl", "ts_project", "ts_sources", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_sources(
    name = "canvas_sources",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = ["//ts/math:math_sources"],
)

ts_project(
    name = "canvas",
    srcs = [":canvas_sources"],
)

ts_test(
    name = "tests",
    srcs = [":canvas"],
)
