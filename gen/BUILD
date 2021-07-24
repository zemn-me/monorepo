load("@npm//@bazel/typescript:index.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
package(default_visibility = [":__subpackages__", "//solve:__subpackages__"]) 

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

genrule(
    name = "gen_core",
    srcs = glob(["cultist_data/content/core/**/*.json"]),
    exec_tools = [ ":collate_game_core" ],
    outs = [ "core_en.json" ],
    cmd = "./$(execpath //gen:collate_game_core) $(SRCS) > $@",
    message = "generating collated game data"
)


