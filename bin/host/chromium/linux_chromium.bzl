"""Launch Linux Chrome with space for its Unix socket under Bazel."""

load(
    "@aspect_bazel_lib//lib:copy_to_bin.bzl",
    "COPY_FILE_TO_BIN_TOOLCHAINS",
    "copy_file_to_bin_action",
)

def _linux_chromium_impl(ctx):
    files = []
    chrome = None
    for src in ctx.files.srcs:
        copied = copy_file_to_bin_action(ctx, src)
        files.append(copied)
        if src == ctx.file.executable_src:
            chrome = copied
    if chrome == None:
        fail("executable_src was not present in srcs")

    launcher = ctx.actions.declare_file("chrome_launcher", sibling = chrome)
    # Chrome creates a SingletonSocket under TMPDIR even with a custom profile.
    # Bazel's long sandbox TMPDIR exceeds Linux's Unix socket path limit.
    ctx.actions.write(
        launcher,
        "#!/bin/sh\nexport TMPDIR=/tmp\nexec \"$(dirname \"$0\")/chrome\" \"$@\"\n",
        is_executable = True,
    )
    return DefaultInfo(
        executable = launcher,
        files = depset([launcher]),
        runfiles = ctx.runfiles(files = files),
    )

linux_chromium = rule(
    implementation = _linux_chromium_impl,
    attrs = {
        "executable_src": attr.label(allow_single_file = True, mandatory = True),
        "srcs": attr.label_list(allow_files = True, mandatory = True),
    },
    executable = True,
    toolchains = COPY_FILE_TO_BIN_TOOLCHAINS,
)
