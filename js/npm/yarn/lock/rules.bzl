def _lockfile_minimize(ctx):
    ctx.actions.run_shell(
        outputs = [ctx.outputs.lockfile_out],
        inputs = [ctx.file.lockfile, ctx.file.package_json],
        tools = [ctx.executable.yarn],
        env = {
            "YARN": ctx.executable.yarn.path,
            "LOCKFILE": ctx.file.lockfile.path,
            "PACKAGE_JSON": ctx.file.package_json.path,
            "OUTPUT_LOCKFILE": ctx.outputs.lockfile_out.path,
        },
        mnemonic = "LockfileMinimize",
        command = """
            TARGET_DIR="$(mktemp -d)"
            cp $LOCKFILE $TARGET_DIR/yarn.lock
            cp $PACKAGE_JSON $TARGET_DIR/package.json
            $YARN --emoji --non-interative --cwd $TARGET_DIR
            cp $TARGET_DIR/yarn.lock $OUTPUT_LOCKFILE
            rm -rf $TARGET_DIR
        """,
    )

_lockfile_minimize_rule = rule(
    implementation = _lockfile_minimize,
    attrs = {
        "lockfile": attr.label(mandatory = True, allow_single_file = True),
        "package_json": attr.label(mandatory = True, allow_single_file = True),
        "yarn": attr.label(mandatory = True, executable = True, cfg = "target"),
        "lockfile_out": attr.output(),
    },
)

def lockfile_minimize(name, **kwargs):
    _lockfile_minimize_rule(
        name = name,
        yarn = "@npm//:yarn/bin:yarn",
        **kwargs
    )
