load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "shape",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    resolve_json_module = True,
    deps = [
        "//ts/math",
        "//ts/math/canvas",
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

jest_test(
    name = "shape_test",
    srcs = ["shape_test.js"],
    jsdom = True,
    deps = [":shape"],
)
