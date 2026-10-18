"""
Taken from https://github.com/buildbuddy-io/buildbuddy/blob/0e46543c957fa3fc2341151b5ca632408a3c06b2/rules/go/index.bzl

Thank you BuildBuddy!

Used to address https://github.com/bazelbuild/rules_go/issues/511
"""

load("@aspect_bazel_lib//lib:paths.bzl", "BASH_RLOCATION_FUNCTION", "to_rlocation_path")
load("@bazel_skylib//lib:paths.bzl", "paths")
load("@io_bazel_rules_go//go:def.bzl", "go_context")

def _go_sdk_tool_impl(ctx):
    # Locate the File object corresponding to the tool path. This is needed for
    # bazel to be able to create an executable symlink to that tool and to be
    # able to recreate the symlink if the tool changes.
    go = go_context(ctx)
    tool_path = paths.join(go.sdk.root_file.dirname, ctx.attr.goroot_relative_path)
    tool = None

    sdk_tools = []
    sdk_tools.append(go.sdk.go)  # `go` binary
    sdk_tools.extend(go.sdk.tools.to_list())  # all other tools, e.g. `gofmt`

    for f in sdk_tools:
        if f.path == tool_path:
            tool = f
            break
    if not tool:
        fail("could not locate SDK tool '%s'" % tool_path)

    executable = ctx.actions.declare_file(ctx.attr.name)
    runfiles = ctx.runfiles(files = [executable])
    if ctx.attr.goroot_relative_path == "bin/go":
        # The SDK's Go executable is trimmed and cannot infer GOROOT after Bazel
        # materializes it as a regular file on a remote executor.
        ctx.actions.write(
            executable,
            "#!/usr/bin/env bash\n" + BASH_RLOCATION_FUNCTION + """
export GOROOT="$(dirname "$(rlocation "%s")")"
exec "$GOROOT/bin/go" "$@"
""" % to_rlocation_path(ctx, go.sdk.root_file),
            is_executable = True,
        )
        runfiles = runfiles.merge(ctx.runfiles(
            files = [go.sdk.root_file, go.sdk.go],
            transitive_files = depset(transitive = [go.sdk.tools, go.sdk.headers, go.sdk.srcs, go.sdk.libs]),
        )).merge(ctx.attr._runfiles[DefaultInfo].default_runfiles)
    else:
        ctx.actions.symlink(output = executable, target_file = tool, is_executable = True)

    return [DefaultInfo(
        files = depset([executable]),
        runfiles = runfiles,
        executable = executable,
    )]

go_sdk_tool = rule(
    doc = "Declares a run target from the go SDK.",
    attrs = {
        "goroot_relative_path": attr.string(mandatory = True, doc = "Tool path relative to the go SDK root (GOROOT)"),
        "_runfiles": attr.label(default = "@rules_shell//shell/runfiles"),
        "_go_context_data": attr.label(
            default = "@io_bazel_rules_go//:go_context_data",
        ),
    },
    implementation = _go_sdk_tool_impl,
    executable = True,
    toolchains = ["@io_bazel_rules_go//go:toolchain"],
)
