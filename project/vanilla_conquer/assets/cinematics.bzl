"""Publish individually addressed cinematic packages and their typed catalog."""

load("//ts/remix:public_assets.bzl", "PublicAssetsInfo")

def _cinematics_impl(ctx):
    public_dir = ctx.actions.declare_directory("sha256")
    module = ctx.actions.declare_file("cinematics.ts")
    args = ctx.actions.args()
    args.add("--allied", ctx.file.allied.path)
    args.add("--soviet", ctx.file.soviet.path)
    args.add("--mixtool", ctx.executable.mixtool.path)
    args.add("--public-dir", public_dir.path)
    args.add("--module", module.path)
    ctx.actions.run(
        executable = ctx.executable._packager,
        arguments = [args],
        inputs = [ctx.file.allied, ctx.file.soviet],
        tools = [ctx.attr.mixtool[DefaultInfo].files_to_run],
        outputs = [public_dir, module],
        mnemonic = "RedAlertCinematics",
        progress_message = "Packaging individual Red Alert cinematics",
    )
    return [
        DefaultInfo(files = depset([module])),
        PublicAssetsInfo(public_assets = depset([public_dir])),
    ]

cinematics = rule(
    implementation = _cinematics_impl,
    attrs = {
        "allied": attr.label(allow_single_file = True, mandatory = True),
        "soviet": attr.label(allow_single_file = True, mandatory = True),
        "mixtool": attr.label(executable = True, cfg = "exec", mandatory = True),
        "_packager": attr.label(default = ":package_cinematics", executable = True, cfg = "exec"),
    },
)
