load("@rules_proto//proto:defs.bzl", "proto_library")
load("@com_google_protobuf//:protobuf.bzl", "py_proto_library")

package(default_visibility = ["//:__subpackages__"])

proto_library(
    name = "cultist_proto",
    srcs = ["cultist.proto"],
    deps = ["@com_google_protobuf//:struct_proto"],
)

py_proto_library(
    name = "cultist_py_proto",
    srcs = ["cultist.proto"],
    deps = ["@com_google_protobuf//:protobuf_python"],
)
