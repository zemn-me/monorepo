load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "testing",
    srcs = [
        "hello.ts",
        "index.ts",
    ],
)

esbuild(
    name = "esbuild",
    config = "//:esbuild_config",
    entry_points = ["index.ts"],
    link_workspace_root = True,
    metafile = False,
    minify = True,
    output_dir = "es_out",
    deps = ["testing"],
)
