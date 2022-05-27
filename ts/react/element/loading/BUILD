load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "loading",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
)
