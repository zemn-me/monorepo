load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "url",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/node",
        "@npm//@types/react",
        "@npm//react",
    ],
)

jest_test(
    name = "url",
    srcs = ["url_test.js"],
    jsdom = True,
    project_deps = [":url"],
)
