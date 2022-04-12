load("//js:rules.bzl", "js_binary")
load("//ts:rules.bzl", "ts_project")
load("@rules_proto//proto:defs.bzl", "proto_library")
load("@com_google_protobuf//:protobuf.bzl", "py_proto_library")

package(default_visibility = [
    "//project/cultist:__subpackages__",
])

ts_project(
    name = "collate_game_core_ts",
    srcs = [
        "*.json",
        "*.ts",
    ],
    deps = [
        "@npm//@types/node",
    ],
)

js_binary(
    name = "collate_game_core",
    entry_point = "collate_game_core.js",
)

genrule(
    name = "gen_core",
    srcs = ["@cultistsimulator//:core"],
    outs = ["core_en.json"],
    cmd = "./$(execpath //project/cultist/gen:collate_game_core) $(locations @cultistsimulator//:core) > $@",
    exec_tools = [":collate_game_core"],
    message = "generating collated game data",
)

proto_library(
    name = "core_proto",
    srcs = ["core.proto"],
    deps = [
        "//project/cultist/proto:cultist_proto",
        "@com_google_protobuf//:struct_proto",
    ],
)

py_proto_library(
    name = "core_py_proto",
    srcs = ["core.proto"],
    deps = [
        "//project/cultist/proto:cultist_py_proto",
        "@com_google_protobuf//:protobuf_python",
    ],
)

py_library(
    name = "core_py",
    srcs = ["core.py"],
    data = ["//project/cultist/gen:core_en.json"],
    deps = ["//project/cultist/gen:core_py_proto"],
)
