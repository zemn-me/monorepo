load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "scale",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//ts",
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//react",
    ],
)

jest_test(
    name = "tests",
    srcs = ["scale_test.js"],
    jsdom = True,
    project_deps = [":scale"],
)
