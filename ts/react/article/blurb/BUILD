load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "blurb",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

ts_test(
    name = "tests",
    srcs = ["blurb_test.js"],
    jsdom = True,
    project_deps = [":blurb"],
)
