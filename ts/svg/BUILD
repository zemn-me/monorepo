load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
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
        "//ts/math",
        "@npm//@types/d3-axis",
        "@npm//@types/d3-scale",
        "@npm//@types/react",
        "@npm//d3-axis",
        "@npm//d3-scale",
        "@npm//react",
    ],
)
