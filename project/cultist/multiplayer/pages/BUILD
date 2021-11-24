load("//:rules.bzl", "ts_project")

package(default_visibility = ["//project/cultist/multiplayer:__subpackages__"])

ts_project(
    name = "pages",
    srcs = [
        "index.tsx",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
    ],
)
