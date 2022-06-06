

def semver_version(name, **kwargs):
    _semver_version(
        name = name,
        output = name + ".txt",
        **kwargs
    )

def _semver_version_impl(ctx):
    ctx.actions.run_shell(
        outputs = [ ctx.outputs.output ],
        inputs = [
            ctx.file.major,
            ctx.file.minor,
            ctx.file.patch
        ],
        arguments = [ file.path for file in [
            ctx.outputs.output,
            ctx.file.major,
            ctx.file.minor,
            ctx.file.patch
        ] ],
        command = "cat <(echo v) $2 <(echo .) $3 <(echo .) $4 | tr -d '\n' > $1",
        progress_message = "Concatenating version number..."
    )


_semver_version = rule(
    implementation = _semver_version_impl,
    attrs = {
        "major": attr.label(allow_single_file = True, mandatory = True),
        "minor": attr.label(allow_single_file = True, mandatory = True),
        "patch": attr.label(allow_single_file = True, mandatory = True),
        "output": attr.output(mandatory = True)
    }
)