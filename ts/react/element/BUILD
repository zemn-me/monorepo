load("//ts:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "elements",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//ts/react/element/link",
    ],
)
