load("//:rules.bzl", "nodejs_binary", "ts_project")

ts_project(
    name = "gen_pkgjson",
    srcs = [
        "gen_pkgjson.ts",
    ],
    deps = [
        "@npm//@types/node",
        "@npm//commander",
    ],
)

nodejs_binary(
    name = "gen_pkgjson_bin",
    data = [
        ":npm_deps",
        "//:package.json",
    ],
    entry_point = "gen_pkgjson.js",
)
