load("@aspect_rules_js//js:defs.bzl", "js_run_binary")
load("@bazel_skylib//lib:paths.bzl", "paths")
load("//ts:rules.bzl", "ts_project")
load("//js:rules.bzl", "js_library")

def mdx_to_js(name = None, srcs = [], assets = None, deps = [], outs = None, **kwargs):
    if outs == None:
        outs = [paths.replace_extension(src, ".js") for src in srcs]
    jsfiles = outs
    sourcemapfiles = [fn + ".map" for fn in jsfiles]
    outs = jsfiles + sourcemapfiles
    args_deep = [["--input", "$(location " + src + ")"] for src in srcs] + [
        ["--output", "$(location " + fn + ")"]
        for fn in jsfiles
    ]
    args = [item for sublist in args_deep for item in sublist]
    js_run_binary(
        name = name + "_gen_js",
        srcs = srcs,
        tool = "//ts/mdx/cmd/mdx-transform",
        outs = outs,
        args = args,
    )

    native.filegroup(
        name = name + "_sources",
        srcs = outs,
    )

    if assets != None:
        outs += assets

    js_library(
        name = name,
        srcs = outs,
        deps = [
            "//:node_modules/react",
        ] + deps,
        **kwargs
    )
