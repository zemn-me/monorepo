load("//ts:rules.bzl", "ts_project",  "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "canvas",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = ["//ts/math:math_sources"],
)

ts_test(
    name = "tests",
    srcs = [":canvas"],
)
