"""Build the emulator with its patches using the repository's Rust toolchain."""

def _emulator_binary_impl(ctx):
    rust = ctx.toolchains["@rules_rust//rust:toolchain_type"]
    args = ctx.actions.args()
    args.add(ctx.file.src)
    args.add(ctx.outputs.out)
    args.add(rust.cargo)
    args.add(rust.rustc)
    args.add(rust.rust_doc)
    args.add(ctx.file.patch)
    args.add_all(ctx.files.crates)
    ctx.actions.run(
        executable = ctx.executable._build,
        arguments = [args],
        inputs = depset([ctx.file.src, ctx.file.patch] + ctx.files.crates, transitive = [rust.all_files]),
        outputs = [ctx.outputs.out],
        use_default_shell_env = True,
        mnemonic = "BuildAwsEmulator",
        progress_message = "Building patched AWS Emulator from its pinned sources",
    )
    return [DefaultInfo(executable = ctx.outputs.out)]

emulator_binary = rule(
    implementation = _emulator_binary_impl,
    executable = True,
    attrs = {
        "crates": attr.label(mandatory = True),
        "out": attr.output(mandatory = True),
        "patch": attr.label(allow_single_file = True, mandatory = True),
        "src": attr.label(allow_single_file = True, mandatory = True),
        "_build": attr.label(default = "//bzl/aws_emulator:build_emulator", executable = True, cfg = "exec"),
    },
    toolchains = ["@rules_rust//rust:toolchain_type"],
)
