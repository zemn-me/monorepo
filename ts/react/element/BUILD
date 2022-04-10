load("//ts:rules.bzl", "ts_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "elements",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    deps = [
        "//ts/react/element/link:link",
    ],
    tsconfig = "//:tsconfig_jsx",
)
