load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
load("@npm//next:index.bzl", "next")
load("//:rules.bzl", "ts_lint", "ts_project")

ts_lint(
    name = "lint",
    data = glob(["**/*.ts", "**/*.js"])
)


genrule(
    name = "multiplayer",
    outs = [ "build.tar.gz"],
    srcs = glob(["**/*"], exclude=["next.config.ts"]) + [":next.config.js"],
    exec_tools = [
        "@npm//next/bin:next",
        "@npm//:node_modules"

    ] + [],
    cmd = """
        $(execpath @npm//next/bin:next) build ./cultist/multiplayer &&
        $(execpath @npm//next/bin:next) export ./cultist/multiplayer &&
        tar -czvf $@ ./cultist/multiplayer/out
    """
)

next(
    name = "next",
    data = glob(["**/*"], exclude=["next.config.ts"]) + [":next.config.js"],
    args = [ "./cultist/multiplayer" ]
)

next(
    name = "start",
    data = glob(["**/*"], exclude=["next.config.ts"]) + [":next.config.js"],
    args = [ "./cultist/multiplayer", "start" ]
)

ts_project(
    name = "config_js",
    srcs = [ "next.config.ts" ],
    declaration = True,
    tsconfig = "//:tsconfig_node",
    deps = [ "@npm//@types/node", "@npm//next" ]
)
