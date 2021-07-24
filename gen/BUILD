load("@npm//@bazel/typescript:index.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")

ts_project(
    name="gen",
    srcs=glob(["*.ts"]),
    tsconfig="//:tsconfig.json"
)

nodejs_binary(
    name="run_gen",
    entry_point="gen.js"
)


