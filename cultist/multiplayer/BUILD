load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary")
load("@npm//next:index.bzl", "next")
load("//:rules.bzl", "ts_lint", "ts_config")

ts_lint(
    name = "lint",
    data = glob(["**/*.ts", "**/*.js"])
)


genrule(
    name = "multiplayer",
    outs = [ "build.tar.gz"],
    srcs = glob(["**/*"]),
    exec_tools = [
        "@npm//next/bin:next",
        "@npm//:node_modules",
        ":tsconfig"
    ] + [],
    cmd = """
        $(execpath @npm//next/bin:next) build $$(dirname $(location :next.config.js));
        tar -czvf $@ $$(dirname $(location :next.config.js))
    """
)

next(
    name = "next",
    data = glob(["**/*"]) + [ ":tsconfig" ],
    args = [ "$(location :next.config.js)/.." ]
)

next(
    name = "start",
    data = glob(["**/*"]) + [ ":tsconfig" ],
    args = [ "$(location :next.config.js)/..", "start" ]
)

ts_config(
    name = "tsconfig",
    deps = ["//typescript/config:jsx"],
    src = "tsconfig.json"
)
