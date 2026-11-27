"""Fetch pinned GitHub action archives and expose their contents as test data."""

def _github_action_archives_impl(ctx):
    archives = []
    downloads = []
    for action, sha256 in json.decode(ctx.read(ctx.attr.lock)).items():
        repo, _, commit = action.partition("@")
        parts = repo.split("/")
        if len(parts) != 2 or any([part in ("", ".", "..") for part in parts]):
            fail("Expected owner/repo in %s" % action)
        if len(commit) != 40 or commit.strip("0123456789abcdef"):
            fail("Expected a full Git commit in %s" % action)
        if len(sha256) != 64 or sha256.strip("0123456789abcdef"):
            fail("Expected an archive SHA-256 for %s" % action)
        archive = action + ".zip"
        archives.append(archive)
        downloads.append(ctx.download(
            url = "https://codeload.github.com/%s/zip/%s" % (repo, commit),
            output = archive,
            sha256 = sha256,
            block = False,
        ))
    for download in downloads:
        download.wait()
    ctx.file("BUILD.bazel", """
package(default_visibility = ["//visibility:public"])
archives = %s
exports_files(archives)
filegroup(name = "archives", srcs = archives)
""" % repr(archives))

github_action_archives = repository_rule(
    implementation = _github_action_archives_impl,
    attrs = {"lock": attr.label(mandatory = True, allow_single_file = [".json"])},
)

def _github_action_cache_impl(ctx):
    tar = ctx.toolchains["@aspect_bazel_lib//lib:tar_toolchain_type"].tarinfo.binary
    archives = []
    for archive in ctx.files.archives:
        pin = archive.dirname.rsplit("/", 1)[-1] + "/" + archive.basename.removesuffix(".zip")
        output = ctx.actions.declare_file(ctx.label.name + "/" + pin + ".tar")

        # act takes plain tars rooted at the repository. Preserve relative
        # symlink targets when dropping GitHub's enclosing directory.
        ctx.actions.run(
            executable = tar,
            inputs = [archive],
            outputs = [output],
            arguments = ["-cf", output.path, "-s", ",^[^/]*/,,S", "@" + archive.path],
            mnemonic = "GitHubActionTar",
        )
        archives.append(output)

    return [DefaultInfo(files = depset(archives), runfiles = ctx.runfiles(files = archives))]

github_action_cache = rule(
    implementation = _github_action_cache_impl,
    attrs = {"archives": attr.label(mandatory = True, allow_files = [".zip"])},
    toolchains = ["@aspect_bazel_lib//lib:tar_toolchain_type"],
)
