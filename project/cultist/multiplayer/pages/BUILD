load("//:rules.bzl", "ts_project")

package(default_visibility = ["//project/cultist/multiplayer:__subpackages__"])

ts_project(
    name = "pages",
    srcs = [
        "index.tsx",
    ],
    project_deps = [
        "//project/cultist/example:example",
        "//project/cultist/react:react",
        "//project/cultist/state:state",
        "//project/cultist:save",
        "//project/cultist/gen:core_en_project"
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "@npm//@types/react",
        "@npm//react",
    ],
)
