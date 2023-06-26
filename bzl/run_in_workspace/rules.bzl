"""
Provider and macro to allow a binary to work in the
working directory of the actual repo (for example for dev-time tooling).

Macro works with $(rootpath) substitution and *only* rootpath substitution.
"""

def generate_run_in_workspace_script_impl(ctx):
    rootpath_mappings = {}

    # list of Targets
    # see https://bazel.build/rules/lib/builtins/Target.html
    for target in ctx.attr.deps + [ctx.attr.src]:
        file = target.files.to_list()[0].short_path
        rootpath_mappings[str(target.label)] = file

        # without the @
        rootpath_mappings[str(target.label)[1:]] = file
        rootpath_mappings[str(target.label.name)] = file
        rootpath_mappings[":" + str(target.label.name)] = file

    rootpath_block = "\n".join([
        'if [[ "$1" == "{key}" ]]; then echo "{value}"; return 0; fi'.format(key = k, value = rootpath_mappings[k])
        for k in rootpath_mappings
    ])

    ctx.actions.expand_template(
        template = ctx.file.script_template,
        output = ctx.outputs.output_script,
        substitutions = {
            "$TARGET_PROGRAM": ctx.file.src.short_path,
            "$BUILD_TIME_ARGS": " ".join(ctx.attr.args) if ctx.attr.args != None else "",
            "$ROOTPATHS": rootpath_block,
        },
    )

generate_run_in_workspace_script = rule(
    implementation = generate_run_in_workspace_script_impl,
    attrs = {
        "src": attr.label(mandatory = True, allow_single_file = True),
        "output_script": attr.output(mandatory = True),
        "script_template": attr.label(allow_single_file = True, mandatory = True),
        "deps": attr.label_list(allow_files = True),
        "args": attr.string_list(),
    },
)

def run_in_workspace(name, src, data = [], deps = [], args = None, **kwargs):
    out_file_name = name + "_out.sh"
    generate_run_in_workspace_script(
        src = src,
        name = name + ".gen_sh",
        script_template = "//bzl/run_in_workspace:wrapper.template.sh",
        output_script = out_file_name,
        args = args,
        deps = deps,
    )

    native.sh_binary(
        name = name,
        srcs = [out_file_name],
        data = data + [src],
        deps = ["@bazel_tools//tools/bash/runfiles"],
        **kwargs
    )
