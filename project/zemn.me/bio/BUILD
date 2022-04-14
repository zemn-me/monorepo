load("//ts:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "bio",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//ts/react/lang",
        "//ts/time",
    ],
)
