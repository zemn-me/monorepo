load("//:rules.bzl", "go_binary", "ts_lint", "ts_project")
load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("@npm//esbuild:index.bzl", run_esbuild = "esbuild")

esbuild(
    name = "multiplayer",
    entry_point = "//project/cultist/multiplayer/pages:index.tsx",
    minify = True,
    output_dir = "es_out",
    splitting = True,
    deps = ["//project/cultist/multiplayer/pages:pages_ts"],
)

go_binary(
    name = "start",
    srcs = ["test_server.go"],
    embedsrcs = [
        ":multiplayer",
        "//project/cultist/multiplayer/public:index.html",
    ],
)
