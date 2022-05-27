load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "bio",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    incremental = True,
    project_deps = [
        "//ts/react/lang:lang",
        "//ts/time:time",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/jest",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)
