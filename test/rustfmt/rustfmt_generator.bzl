load("@io_bazel_rules_rust//rust:private/utils.bzl", "find_toolchain")

def _rustfmt_generator_impl(ctx):
    toolchain = find_toolchain(ctx)
    rustfmt_bin = toolchain.rustfmt
    output = ctx.outputs.out

    ctx.actions.run_shell(
        inputs = depset([rustfmt_bin, ctx.file.src]),
        outputs = [output],
        command = "{} --emit stdout --quiet {} > {}".format(rustfmt_bin.path, ctx.file.src.path, output.path),
        tools = [rustfmt_bin],
    )


rustfmt_generator = rule(
    _rustfmt_generator_impl,
    doc = "Given an unformatted Rust source file, output the file after being run through rustfmt.",
    attrs = {
        "src": attr.label(
            doc = "The file to be formatted.",
            allow_single_file = True,
        )
    },
    outputs = {"out": "%{name}.rs"},
    toolchains = [
        "@io_bazel_rules_rust//rust:toolchain",
    ],
)
