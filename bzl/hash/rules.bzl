def _impl(ctx):
    # Create actions to generate the three output files.
    # Actions are run only when the corresponding file is requested.

    inputs = ctx.files.srcs
    arguments = [file.path for file in ctx.files.srcs]

    ctx.actions.run_shell(
        outputs = [ctx.outputs.md5],
        inputs = inputs,
        command = "md5sum $@ > {}".format(ctx.outputs.md5.path),
        arguments = arguments,
    )
    ctx.actions.run_shell(
        outputs = [ctx.outputs.md5],
        inputs = inputs,
        command = "md5sum $@ > {}".format(ctx.outputs.md5.path),
        arguments = arguments,
    )

    ctx.actions.run_shell(
        outputs = [ctx.outputs.sha1],
        inputs = inputs,
        command = "sha1sum $@ > {}".format(ctx.outputs.sha1.path),
        arguments = arguments,
    )

    ctx.actions.run_shell(
        outputs = [ctx.outputs.sha256],
        inputs = inputs + [ctx.executable.sha256_bin],
        command = "{} $@ > {}".format(ctx.executable.sha256_bin.path, ctx.outputs.sha256.path),
        arguments = arguments,
    )

    # By default (if you run `bazel build` on this target, or if you use it as a
    # source of another target), only the sha256 is computed.
    return DefaultInfo(files = depset([ctx.outputs.sha256]))

_hashes = rule(
    implementation = _impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True, allow_files = True),
        "md5": attr.output(),
        "sha1": attr.output(),
        "sha256": attr.output(),
        "sha256_bin": attr.label(mandatory = True, executable = True, cfg = "target"),
    },
)

def hashes(**kwargs):
    name = kwargs["name"]
    _hashes(
        md5 = "%s.md5" % name,
        sha1 = "%s.sha1" % name,
        sha256 = "%s.sha256" % name,
        sha256_bin = "//rs/cmd/sha256",
        **kwargs
    )
