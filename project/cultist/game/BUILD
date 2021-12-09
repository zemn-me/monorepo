load("//:rules.bzl", "nodejs_binary", "ts_project")
load("@rules_proto//proto:defs.bzl", "proto_library")
load("@com_google_protobuf//:protobuf.bzl", "py_proto_library")

package(default_visibility = [
    "//project/cultist:__subpackages__",
])

ts_project(
    name = "collate_game_core",
    srcs = ["collate_game_core.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/node",
    ],
)

nodejs_binary(
    name = "collate_game_core",
    entry_point = "collate_game_core.js",
)

genrule(
    name = "gen_core_en",
    srcs = glob(["content/core/**/*.json"]),
    outs = ["core_en.json"],
    cmd = "$(execpath :collate_game_core) $(SRCS) > $@",
    exec_tools = [":collate_game_core"],
    message = "generating collated game data for english cultist simulatoe",
)
