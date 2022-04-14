load("//js:rules.bzl", "js_binary")
load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "sort_tool",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    tsconfig = "//:tsconfig_node",
)

js_binary(
    name = "exec",
    entry_point = "sort_tool.js",
)
