load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "scale",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    resolve_json_module = True,
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
    deps = [":scale"],
)
