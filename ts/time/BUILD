load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    deps = [
        "//ts",
        "@npm//@types/jest",
        "@npm//ts-toolbelt",
    ],
)

jest_test(
    name = "tests",
    srcs = ["date_test.js"],
    project_deps = [":time"],
)
