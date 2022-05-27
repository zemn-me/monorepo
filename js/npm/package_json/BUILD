load("//:rules.bzl", "nodejs_binary", "ts_project")

ts_project(
    name = "gen_pkgjson",
    srcs = [
        "gen_pkgjson.ts",
    ],
    visibility = ["//:__subpackages__"],
    deps = [
        "@npm//@bazel/runfiles",
        "@npm//@types/node",
        "@npm//commander",
    ],
)
