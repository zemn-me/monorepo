load("//:rules.bzl", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "react",
    srcs = ["board.tsx", "index.tsx"],
    project_deps = [
        "//project/cultist:state",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
    ],
)
