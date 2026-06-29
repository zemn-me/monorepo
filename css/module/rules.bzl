load("//js:rules.bzl", "js_library")

def _css_module_types_impl(ctx):
    out = ctx.actions.declare_file(ctx.file.src.basename + ".d.ts")
    args = ctx.actions.args()
    args.add(ctx.file.src)
    args.add(out)

    ctx.actions.run(
        executable = ctx.executable._generator,
        inputs = [ctx.file.src],
        outputs = [out],
        arguments = [args],
        mnemonic = "CssModuleTypes",
        progress_message = "Generating CSS module types for %{input}",
    )

    return [DefaultInfo(files = depset([out]))]

_css_module_types = rule(
    implementation = _css_module_types_impl,
    attrs = {
        "src": attr.label(allow_single_file = [".css"], mandatory = True),
        "_generator": attr.label(
            default = Label("//css/module/cmd/cssmoduledts"),
            executable = True,
            cfg = "exec",
        ),
    },
)

def css_module(name, src, visibility = None, **kwargs):
    _css_module_types(
        name = name + "_types",
        src = src,
    )

    js_library(
        name = name,
        srcs = [":" + name + "_types"],
        data = [src],
        visibility = visibility,
        **kwargs
    )
