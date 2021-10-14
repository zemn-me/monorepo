load("//:rules.bzl", "jest_test", "ts_project")
load("//css:rules.bzl", "css_module")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [":time_css"],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//css:css_loader",
        "@npm//@types/react",
        "@npm//classnames",
        "@npm//react",
    ],
)

css_module(
    name = "time_css",
    srcs = ["time.module.css"],
)
