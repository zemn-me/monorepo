"""Fetch the emulator source and the crates its upstream Cargo.lock pins."""

def _aws_emulator_impl(ctx):
    ctx.download(
        url = "https://codeload.github.com/aws/aws-emulator/tar.gz/" + ctx.attr.commit,
        output = "source.tar.gz",
        sha256 = ctx.attr.sha256,
    )

    # Read the lockfile from the verified archive without expanding the entire
    # emulator on the Bazel client. The source build runs on the Linux executor.
    result = ctx.execute(["python3", ctx.path(ctx.attr._registry), ctx.path("source.tar.gz"), ctx.attr.commit], timeout = 180)
    if result.return_code:
        fail(result.stderr)
    packages = json.decode(result.stdout)
    for start in range(0, len(packages), 20):
        downloads = []
        for pkg in packages[start:start + 20]:
            archive = "{}-{}.crate".format(pkg["name"], pkg["version"])
            downloads.append(ctx.download(
                url = "https://static.crates.io/crates/{}/{}".format(pkg["name"], archive),
                output = "crates/" + archive,
                sha256 = pkg["checksum"],
                block = False,
            ))
        for download in downloads:
            download.wait()
    ctx.file("BUILD.bazel", """
exports_files(["source.tar.gz"])
filegroup(name = "crates", srcs = glob(["crates/*.crate"]), visibility = ["//visibility:public"])
""")

aws_emulator = repository_rule(
    implementation = _aws_emulator_impl,
    attrs = {
        "commit": attr.string(mandatory = True),
        "sha256": attr.string(mandatory = True),
        "_registry": attr.label(default = "//bzl/aws_emulator:registry.py"),
    },
)
