load("//:rules.bzl", "nodejs_binary", "ts_project")

ts_project(
    name = "sort_tool",
    srcs = glob([
        "*.ts",
        "*.tsx",
    ]),
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/node",
    ],
)

nodejs_binary(
    name = "exec",
    entry_point = "sort_tool.js",
)
