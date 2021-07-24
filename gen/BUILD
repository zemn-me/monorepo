load("@npm//@bazel/typescript:index.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
package(default_visibility = [":__subpackages__"]) 

ts_project(
    name="gen",
    srcs=glob(["*.ts"]),
    deps=[
        "@npm//@types/node"
    ],
    tsconfig="//:tsconfig"
)

nodejs_binary(
    name="collate_game_core",
    entry_point="collate_game_core.js"
)


