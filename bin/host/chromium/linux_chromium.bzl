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

    runtime = ctx.file.runtime
    files.append(runtime)

    launcher = ctx.actions.declare_file(chrome.basename + "_launcher", sibling = chrome)

    # Chrome creates a SingletonSocket under TMPDIR even with a custom profile.
    # Bazel's long sandbox TMPDIR exceeds Linux's Unix socket path limit.
    ctx.actions.write(
        launcher,
        """#!/bin/sh
set -eu
export TMPDIR=/tmp
# Resolve the declared runtime relative to this executable in either runfiles layout.
runtime_runfile="_main/%s"
if [ -d "$0.runfiles/$runtime_runfile" ]; then
  runtime="$0.runfiles/$runtime_runfile"
elif [ -n "${RUNFILES_DIR:-}" ] && [ -d "$RUNFILES_DIR/$runtime_runfile" ]; then
  runtime="$RUNFILES_DIR/$runtime_runfile"
else
  runtime="$(dirname "$0")/%s"
fi
runtime="$(cd "$runtime" && pwd)"
export FONTCONFIG_FILE="$runtime/fonts.conf"
export LD_LIBRARY_PATH="$runtime/usr/lib/x86_64-linux-gnu:$runtime/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$(dirname "$0")/%s" "$@"
""" % (runtime.short_path, ctx.attr.runtime_relative_path, chrome.basename),
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
        "runtime": attr.label(allow_single_file = True, mandatory = True),
        "runtime_relative_path": attr.string(mandatory = True),
        "executable_src": attr.label(allow_single_file = True, mandatory = True),
        "srcs": attr.label_list(allow_files = True, mandatory = True),
    },
    executable = True,
    toolchains = COPY_FILE_TO_BIN_TOOLCHAINS,
)
