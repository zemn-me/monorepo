load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "lang",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
    ],
)
