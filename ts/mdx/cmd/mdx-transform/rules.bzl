load("@aspect_rules_js//js:defs.bzl", "js_run_binary")

aspect_js_normalization_path = "../../../"

def mdx_to_js(name = None, deps = [], srcs = [], **kwargs):
    input_files = srcs
    input_file_args = [["--input", aspect_js_normalization_path + "$(location " + s + ")"] for s in input_files]

    js_files = srcs

    d_ts_files = [paths.replace_extension(src, ".d.ts") for src in js_files]
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

    native.filegroup(
        name = name + "_sources",
        srcs = outs,
    )

    """
    ts_project(
        name = name,
        srcs = outs,
        deps = [
            "//:node_modules/react",
            "//:node_modules/@types/react",
        ] + deps,
        **kwargs
    )
    """
