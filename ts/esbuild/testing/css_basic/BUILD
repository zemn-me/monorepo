load("@npm//@bazel/esbuild:index.bzl", "esbuild")
load("//ts:rules.bzl", "ts_project")

ts_project(
    name = "testing",
    srcs = [
        "index.ts",
        "test.css"
    ],
    composite = True,
    incremental = True,
    tsconfig = "//:tsconfig",
    deps = [
        "@npm//@types/react",
        "@npm//react",
        "//:base_defs",
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
    srcs = [ "test.css" ]
)
