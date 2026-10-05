"""Keep Chrome executable and runtime resources together in the output tree."""

load(
    "@aspect_bazel_lib//lib:copy_to_bin.bzl",
    "COPY_FILE_TO_BIN_TOOLCHAINS",
    "copy_file_to_bin_action",
)

def _chromium_bundle_impl(ctx):
    runfiles = []
    executable = None
    for src in ctx.files.srcs:
        copied = copy_file_to_bin_action(ctx, src)
        runfiles.append(copied)
        if src == ctx.file.executable_src:
            executable = copied

    if executable == None:
        fail("executable_src was not present in srcs")

    return DefaultInfo(
        executable = executable,
        files = depset([executable]),
        runfiles = ctx.runfiles(files = runfiles),
    )

chromium_bundle = rule(
    implementation = _chromium_bundle_impl,
    attrs = {
        "executable_src": attr.label(allow_single_file = True, mandatory = True),
        "srcs": attr.label_list(allow_files = True, mandatory = True),
    },
    executable = True,
    toolchains = COPY_FILE_TO_BIN_TOOLCHAINS,
)
