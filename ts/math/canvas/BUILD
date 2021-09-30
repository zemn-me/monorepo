load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "canvas",
    srcs = glob(["*.ts", "*.tsx"]),
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//react"
    ],
    project_deps = [
        "//ts/math:math",
    ],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True
)
