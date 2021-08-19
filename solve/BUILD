load("@npm//@bazel/typescript:index.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")

ts_project(
    name = "main_ts",
    srcs = glob(["*.ts"]),
    declaration = True,
    tsconfig = "//:tsconfig",
    deps = [
        "@npm//@types/node",
        "@npm//immutable"
    ],
)

nodejs_binary(
    name = "main",
    entry_point = "main.js",
    data = [ "//gen:core_en.json" ],
)
