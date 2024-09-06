load("@aspect_bazel_lib//lib:copy_file.bzl", "copy_file")
load("@aspect_rules_js//js:defs.bzl", "js_library", "js_run_binary")
load("@bazel_skylib//lib:paths.bzl", "paths")

aspect_js_normalization_path = "../../../"

def mdx_to_js(name = None, deps = [], assets = [], srcs = [], **kwargs):
    input_files = srcs
    input_file_args = [["--input", aspect_js_normalization_path + "$(location " + s + ")"] for s in input_files]

    js_files = [paths.replace_extension(src, ".js") for src in srcs]

    js_file_args = [["--output-js", aspect_js_normalization_path + "$(location " + s + ")"] for s in js_files]

    sourcemap_files = [fn + ".mdx.map" for fn in js_files]
    sourcemap_file_args = [["--output-map", aspect_js_normalization_path + "$(location " + s + ")"] for s in sourcemap_files]

    outs = js_files + sourcemap_files
    args_deep = input_file_args + sourcemap_file_args + js_file_args

    args = [item for sublist in args_deep for item in sublist]
    js_run_binary(
        name = name + "_gen_js",
        srcs = srcs,
        tool = "//ts/mdx/cmd/mdx-transform",
        outs = outs,
        args = args,
    )

    d_ts_files = [paths.replace_extension(src, ".d.ts") for src in js_files]
    d_ts_rule_tags = [name + "_copy_d_ts_" + src for src in js_files]

    for d_ts_file, d_ts_rule_tag in zip(d_ts_files, d_ts_rule_tags):
        copy_file(
            name = d_ts_rule_tag,
            src = "//ts/mdx/cmd/mdx-transform:mdx_file.d.ts",
            out = d_ts_file,
        )

    native.filegroup(
        name = name + "_sources",
        srcs = outs + d_ts_rule_tags,
    )

    js_library(
        name = name,
        deps = [
            "//:node_modules/react",
            "//:node_modules/@types/react",
        ],
        srcs = [name + "_sources"] + assets,
        **kwargs
    )
