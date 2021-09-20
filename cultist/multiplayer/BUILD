load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
load("@npm//next:index.bzl", "next")
load("//:rules.bzl", "ts_lint", "ts_project")

ts_lint(
    name = "lint",
    data = glob([
        "**/*.ts",
        "**/*.js",
    ]),
)

genrule(
    name = "multiplayer",
    srcs = glob(
        ["**/*"],
        exclude = ["next.config.ts"],
    ) + [":next.config.js"],
    outs = ["build.tar.gz"],
    cmd = """
        $(execpath @npm//next/bin:next) build ./cultist/multiplayer &&
        $(execpath @npm//next/bin:next) export ./cultist/multiplayer &&
        tar -czvf $@ ./cultist/multiplayer/out
    """,
    exec_tools = [
        "@npm//next/bin:next",
        "@npm//:node_modules",
    ] + [],
)

next(
    name = "next",
    args = ["./cultist/multiplayer"],
    data = glob(
        ["**/*"],
        exclude = ["next.config.ts"],
    ) + [":next.config.js"],
)

next(
    name = "start",
    args = [
        "./cultist/multiplayer",
        "start",
    ],
    data = glob(
        ["**/*"],
        exclude = ["next.config.ts"],
    ) + [":next.config.js"],
)

ts_project(
    name = "config_js",
    srcs = ["next.config.ts"],
    composite = True,
    declaration = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/node",
        "@npm//next",
    ],
)
