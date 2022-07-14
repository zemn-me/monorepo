load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "blurb",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    resolve_json_module = True,
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

jest_test(
    name = "tests",
    srcs = ["blurb_test.js"],
    jsdom = True,
    deps = [":blurb"],
)
