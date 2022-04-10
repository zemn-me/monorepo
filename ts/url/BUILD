load("//ts:rules.bzl", "ts_project", "ts_test")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "url",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//react",
    ],
)

ts_test(
    name = "url",
    srcs = ["url_test.js"],
    project_deps = [":url"],
)
