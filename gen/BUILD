load("@npm//@bazel/typescript:index.bzl", "ts_project")
load("@rules_proto//proto:defs.bzl", "proto_library")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
load("@rules_pkg//:pkg.bzl", "pkg_zip")
load("@com_google_protobuf//:protobuf.bzl", "py_proto_library")

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
    srcs = [ "//gen/cultist_data:steam_gen_cultist_out.zip" ],
    tools = [ "@bazel_tools//tools/zip:zipper" ],
    exec_tools = [ ":collate_game_core" ],
    outs = [ "core_en.json" ],
    cmd = "$(execpath @bazel_tools//tools/zip:zipper) x $(location //gen/cultist_data:steam_gen_cultist_out.zip) -d $(location :core_en.json)_gamedir_tmp &&" +
        "find $@_gamedir_tmp/CS_Data/StreamingAssets/content/core -name '*.json' | xargs ./$(execpath //gen:collate_game_core) > $@",
    message = "generating collated game data"
)

proto_library (
    name = "core_proto",
    srcs = [ "core.proto" ],
    deps = [ "//proto:cultist_proto", "@com_google_protobuf//:struct_proto" ],
)


py_proto_library (
    name = "core_py_proto",
    srcs = [ "core.proto" ],
    deps = [ "//proto:cultist_py_proto", "@com_google_protobuf//:protobuf_python" ]
)




