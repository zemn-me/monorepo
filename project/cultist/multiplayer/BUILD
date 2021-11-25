load("//:rules.bzl", "go_binary", "ts_lint", "ts_project")
load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("@npm//esbuild:index.bzl", run_esbuild = "esbuild")

ts_project(
    name = "index",
    srcs = [
        "index.tsx",
    ],
    resolve_json_module = True,
    tsconfig = "//:tsconfig_jsx",
    deps = [
        "//project/cultist/multiplayer/pages:pages_ts",
        "@npm//@types/react",
        "@npm//@types/react-dom",
        "@npm//react",
        "@npm//react-dom",
    ],
)

esbuild(
    name = "multiplayer",
    entry_point = "//project/cultist/multiplayer:index.tsx",
    minify = True,
    output_dir = "es_out",
    splitting = True,
    target = "chrome58",
    deps = [":index_ts"],
)

go_binary(
    name = "start",
    srcs = ["test_server.go"],
    embedsrcs = [
        ":multiplayer",
        "//project/cultist/multiplayer/public:index.html",
    ],
)
