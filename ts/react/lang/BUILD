load("//ts:rules.bzl", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "lang",
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
