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
        "@npm//@types/react",
        "@npm//react",
        "@npm//react-dom",
        "@npm//@types/react-dom",
        "//project/cultist/multiplayer/pages:pages_ts"
    ],
)



esbuild(
    name = "multiplayer",
    entry_point = "//project/cultist/multiplayer:index.tsx",
    minify = True,
    output_dir = "es_out",
    splitting = True,
    deps = [":index_ts"],
    target = "chrome58"
)

go_binary(
    name = "start",
    srcs = ["test_server.go"],
    embedsrcs = [
        ":multiplayer",
        "//project/cultist/multiplayer/public:index.html",
    ],
)
