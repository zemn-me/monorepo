"""Extract the versioned AWS Emulator Debian package without installing it."""

def _aws_emulator_impl(ctx):
    ctx.download_and_extract(url = ctx.attr.url, sha256 = ctx.attr.sha256, type = "deb")
    ctx.file("BUILD.bazel", """
exports_files(["data.tar.xz"])
""")

aws_emulator = repository_rule(
    implementation = _aws_emulator_impl,
    attrs = {
        "sha256": attr.string(mandatory = True),
        "url": attr.string(mandatory = True),
    },
)
