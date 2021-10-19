load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]) + [
        "//css:css_loader.d.ts",
    ],
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = ["//ts:ts"],
    deps = [
        "@npm//@types/jest",
        "@npm//ts-toolbelt",
    ],
)

jest_test(
    name = "tests",
    srcs = ["date_test.js"],
    project_deps = [":time"],
)
