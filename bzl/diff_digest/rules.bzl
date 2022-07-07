def _impl(ctx):
    ctx.actions.run_shell(
        outputs = [ ctx.outputs.output ],
        inputs = ctx.files.srcs,
        command = "diff -Nr . \"$(mktemp -d)\" > $1",
        arguments = [ctx.outputs.output.path],
    )

    return DefaultInfo(files = depset([ctx.outputs.output]))

_diff_digest_rule = rule(
    implementation = _impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True, allow_empty = False, allow_files = True),
        "output": attr.output(),
    },
)

def diff_digest(name, output = None, **kwargs):
    if output == None:
        output = name + "_summary.diff"
    _diff_digest_rule(
        name = name,
        output = output,
        **kwargs
    )
