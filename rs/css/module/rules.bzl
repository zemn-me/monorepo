

# TODO: probably add the css dep support. Curently css modules
# are processed on their own.

def _css_module_rule_impl(ctx):
    css_files = []
    ts_files = []
    for i, file in enumerate(ctx.files.srcs):
        if not file.basename.endswith(".module.css"):
            fail("Filename " + file.basename + " must end with .module.css.")
        
        fileWithoutExtension = file.basename.removesuffix(".module.css")

        ts_file = ctx.outputs.ts_outputs[i]
        css_file = ctx.outputs.css_outputs[i]


        ctx.actions.run(
            outputs = [ ts_file, css_file ],
            inputs = [ file ],
            executable = ctx.executable.css_module_gen_binary,
            arguments = [
                "--module-file", file.path,
                "--css-file", css_file.path,
                "--ts-file", ts_file.path,
                "--css-file-import", "monorepo/" + css_file.short_path
            ]
        )

    return DefaultInfo(
        files = depset(ctx.outputs.ts_outputs),
        runfiles = ctx.runfiles(files = ctx.outputs.css_outputs)
    )




_css_module_rule = rule(
    implementation = _css_module_rule_impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True, allow_files = True),
        "css_module_gen_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
        "ts_outputs": attr.output_list(),
        "css_outputs": attr.output_list(),
    }
)

def css_module_rule(name, srcs, **kwargs):
    css_outputs = []
    ts_outputs = []
    for file in srcs:
        if not file.endswith(".module.css"):
            fail("Filename " + file + " must end with .module.css.")
        
        fileWithoutExtension = file.removesuffix(".module.css")

        ts_file = fileWithoutExtension + ".ts"
        css_file = fileWithoutExtension + ".css"

        ts_outputs.append(ts_file)
        css_outputs.append(css_file)
    _css_module_rule(
        name = name,
        srcs = srcs,
        css_module_gen_binary = "//rs/css/module",
        ts_outputs = ts_outputs,
        css_outputs = css_outputs,
        **kwargs
    )
