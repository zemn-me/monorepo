load("//:rules.bzl", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "react",
    srcs = [
        "table.tsx",
        "index.tsx",
        "table.module.css"
    ],
    project_deps = [
        "//project/cultist:state",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "@npm//@types/d3-scale",
        "@npm//d3-scale"
    ],
)
