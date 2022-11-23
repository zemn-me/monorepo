

# TODO: probably add the css dep support. Curently css modules
# are processed on their own.

def _css_module_rule_impl(ctx):
    css_files = []
    ts_files = []
    for file in ctx.files.srcs:
        if not file.basename.endswith(".module.css"):
            fail("Filename " + file.basename + " must end with .module.css.")
        
        fileWithoutExtension = file.basename.removesuffix(".module.css")

        ts_file = ctx.actions.declare_file(fileWithoutExtension + ".ts")
        css_file = ctx.actions.declare_file(fileWithoutExtension + ".css")

        ctx.actions.run(
            outputs = [ ts_file, css_file ],
            inputs = [ file ],
            executable = ctx.executable.css_module_gen_binary,
            arguments = [
                "--module-file", file.path,
                "--css-file", css_file.path,
                "--ts-file", ts_file.path,
                "--css-file-import", css_file.short_path
            ]
        )

        css_files.append(css_file)
        ts_files.append(ts_file)

    return DefaultInfo(
        files = depset(ts_files),
        runfiles = ctx.runfiles(files = css_files)
    )




_css_module_rule = rule(
    implementation = _css_module_rule_impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True, allow_files = True),
        "css_module_gen_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
        "outputs": attr.output_list()
    }
)

def css_module_rule(name, srcs, **kwargs):

    _css_module_rule(
        name = name,
        css_module_gen_binary = "//rs/css/module",
        **kwargs
    )
