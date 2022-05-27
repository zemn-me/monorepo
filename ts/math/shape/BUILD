load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "shape",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    project_deps = [
        "//ts/math:math",
        "//ts/math/canvas:canvas",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

jest_test(
    name = "shape",
    srcs = ["shape_test.js"],
    jsdom = True,
    project_deps = [":shape"],
)
