load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "svg",
    srcs = glob(["*.ts", "*.tsx"]),
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//d3-scale",
        "@npm//d3-axis",
        "@npm//@types/d3-scale",
        "@npm//@types/d3-axis"
    ],
    project_deps = [
        "//ts/math:math",
        "//ts:ts"
    ],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True
)

