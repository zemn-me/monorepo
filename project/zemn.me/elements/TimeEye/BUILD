load("//:rules.bzl", "jest_test", "ts_project")
load("//css:rules.bzl", "css_library")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "TimeEye",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]) + [
        ":css",
    ],
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//:base_defs",
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
    ],
)

css_library(
    name = "css",
    srcs = glob(["*.css"]),
)
