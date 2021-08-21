load("//:rules.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")

ts_project(
    name = "main_ts",
    srcs = glob(["*.ts"]),
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = [
        "@npm//@types/node",
        "@npm//immutable",
        "//cultist"
    ],
)

nodejs_binary(
    name = "main",
    data = ["//gen:core_en.json"],
    entry_point = "main.js",
)
