load("//ts:rules.bzl", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "TimeEye",
    srcs = glob([
        "*.ts",
        "*.tsx",
        "*.css",
    ]),
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
    ],
)
