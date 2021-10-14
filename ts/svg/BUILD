load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [
        "//ts/math:math",
        "//ts:ts",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/d3-axis",
        "@npm//@types/d3-scale",
        "@npm//@types/react",
        "@npm//d3-axis",
        "@npm//d3-scale",
        "@npm//react",
    ],
)
