load("@aspect_rules_js//js:defs.bzl", "js_run_binary")
load("@bazel_skylib//lib:paths.bzl", "paths")
load("//ts:rules.bzl", "ts_project")

def mdx_to_ts(name = None, srcs = [], **kwargs):
    tsfiles = [paths.replace_extension(src, ".ts") for src in srcs]
    sourcemapfiles = [fn + ".map" for fn in tsfiles]
    outs = tsfiles + sourcemapfiles
    args_deep = [["--input", "$(location " + src + ")"] for src in srcs] + [
        ["--output", "$(location " + fn + ")"]
        for fn in tsfiles
    ]
    args = [item for sublist in args_deep for item in sublist]
    js_run_binary(
        name = name + "_gen_ts",
        srcs = srcs,
        tool = "//ts/mdx/cmd/mdx-transform",
        outs = outs,
        args = args,
        **kwargs
    )

    native.filegroup(
        name = name + "_sources",
        srcs = outs,
    )

    ts_project(
        name = name,
        srcs = outs,
        skips_lint = outs,
        deps = ["//:node_modules/react", "//:base_defs"],
    )
