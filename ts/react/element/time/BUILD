load("//:rules.bzl", "ts_project", "jest_test")
load("//css:rules.bzl", "css_module")
package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "time",
    srcs = glob(["*.ts", "*.tsx"]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_jsx",
    resolve_json_module = True,
    deps = [ "@npm//react", "@npm//@types/react", "//css:css_loader", "@npm//classnames" ],
    project_deps = [ ":time_css" ]
)

css_module(
    name = "time_css",
    srcs = [ "time.module.css" ]
)


