load("//:rules.bzl", "ts_project", "jest_test")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "shape",
    srcs = glob(["*.ts", "*.tsx"]),
    deps = [
        "@npm//@types/jest",
        "@npm//react-dom",
        "@npm//react",
        "@npm//@types/react",
        "@npm//@types/react-dom"
    ],
    project_deps = [
        "//ts/math:math",
        "//ts/math/canvas:canvas"
    ],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True
)

jest_test(
    name = "shape",
    project_deps = [ ":shape" ],
    srcs = [ "shape_test.js" ],
    jsdom = True
)


