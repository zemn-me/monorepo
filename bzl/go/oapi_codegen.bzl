"""
Stolen via https://github.com/bazel-contrib/io_bazel_rules_go/issues/4283#issuecomment-2682894008
"""

load("@io_bazel_rules_go//go/private:context.bzl", "go_context")

GO_TOOLCHAIN = Label("@io_bazel_rules_go//go:toolchain")
OAPI_CODEGEN_TOOL = Label("@com_github_oapi_codegen_oapi_codegen_v2//cmd/oapi-codegen:oapi-codegen")

def _go_oapi_codegen_impl(ctx):
    go = go_context(ctx, include_deprecated_properties = False)
    sdk = go.sdk

    inputs_direct = [ctx.file.source]
    inputs_transitive = [sdk.tools, sdk.headers, sdk.srcs]

    args = []
    args += ["-package", ctx.attr.package]
    args += ["-generate", ",".join(ctx.attr.generate)]
    args.append(ctx.file.source.path)

    ctx.actions.run_shell(
        outputs = [ctx.outputs.out],
        inputs = depset(inputs_direct, transitive = inputs_transitive),
        tools = [
            ctx.file.codegen_tool,
            sdk.go,
        ],
        toolchain = GO_TOOLCHAIN,
        command = """
      export GOROOT=$(pwd)/{goroot} &&
      export PATH=$GOROOT/bin:$PATH &&
      {cmd} {args} > {out}
    """.format(
            goroot = sdk.root_file.dirname,
            cmd = "$(pwd)/" + ctx.file.codegen_tool.path,
            args = " ".join(args),
            out = ctx.outputs.out.path,
            mnemonic = "GoOpenApiSourceGen",
        ),
    )

go_oapi_codegen = rule(
    _go_oapi_codegen_impl,
    attrs = {
        "source": attr.label(
            mandatory = True,
            allow_single_file = True,
        ),
        "out": attr.output(
            mandatory = True,
        ),
        "generate": attr.string_list(
            mandatory = False,
        ),
        "package": attr.string(
        ),
        "codegen_tool": attr.label(
            default = OAPI_CODEGEN_TOOL,
            allow_single_file = True,
            executable = True,
            cfg = "exec",
            mandatory = False,
        ),
        "_go_context_data": attr.label(
            default = "@io_bazel_rules_go//:go_context_data",
        ),
    },
    toolchains = [GO_TOOLCHAIN],
)
